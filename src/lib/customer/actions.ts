"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import { computeTotals, type GstMode } from "@/lib/pricing";
import {
  isWithinWindow,
  toNumber,
  happyHourPercentNow,
  distanceMeters,
} from "@/lib/utils";
import { getActiveTableToken } from "@/lib/table-session";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { placeOrderSchema, type PlaceOrderInput } from "@/lib/validation";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: number;
      needsOnlinePayment: boolean;
      sessionId: string;
    }
  | { ok: false; error: string };

// Thrown inside the order transaction when a tracked item is out of stock.
class OutOfStockError extends Error {
  constructor(public itemName: string) {
    super("Out of stock");
  }
}

// When a diner re-scans at a different table, migrate their device's open
// (unpaid) orders to the new table so the bill follows them (auto table-move).
// Possessing the unguessable diningSessionId proves the orders are theirs; the
// scan cookie proves they're physically at the new table.
export async function syncSessionTableAction(
  sessionId: string,
): Promise<{ moved: number }> {
  if (!sessionId) return { moved: 0 };
  const cookieToken = await getActiveTableToken();
  if (!cookieToken) return { moved: 0 };
  const table = await prisma.restaurantTable.findUnique({
    where: { qrToken: cookieToken },
    select: { id: true, restaurantId: true, isActive: true },
  });
  if (!table || !table.isActive) return { moved: 0 };
  const res = await prisma.order.updateMany({
    where: {
      diningSessionId: sessionId,
      restaurantId: table.restaurantId,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
      tableId: { not: table.id },
    },
    data: { tableId: table.id },
  });
  if (res.count > 0) {
    emitEvent({ type: "order.updated", restaurantId: table.restaurantId });
  }
  return { moved: res.count };
}

// Places a customer order. Prices and availability are re-validated against the
// database — never trusted from the client.
export async function placeOrderAction(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid order" };
  }
  const data = parsed.data;

  // Anti-fake-order: the order must come from a device that actually scanned the
  // table QR. proxy.ts sets the httpOnly `sto_table` cookie on scan; the client
  // can't forge it. Reject if it's missing or doesn't match the payload token.
  const cookieToken = await getActiveTableToken();
  if (!cookieToken || cookieToken !== data.qrToken) {
    return {
      ok: false,
      error: "Please scan the table QR again to place your order.",
    };
  }

  const table = await prisma.restaurantTable.findUnique({
    where: { qrToken: cookieToken },
    include: { restaurant: { include: { config: true } } },
  });
  if (!table || !table.isActive || !table.restaurant.config) {
    return { ok: false, error: "This table is not available for ordering." };
  }
  const { restaurant } = table;
  const config = restaurant.config!;

  // Rate-limit per table: dedup rapid double-submits and cap burst spam so one
  // valid scan can't flood the kitchen with fake orders.
  if (!(await rateLimit(`order:${table.id}`, { windowMs: 60_000, max: 6, minGapMs: 5_000 }))) {
    return {
      ok: false,
      error: "You're ordering too quickly — please wait a moment and try again.",
    };
  }

  // Presence check (anti-fake-order). Only enforced when the venue requires it
  // AND has a configured location to compare against (otherwise we can't verify,
  // so we don't punish the diner). On-site → verified; location withheld → held
  // for staff confirmation; clearly remote → blocked.
  let presence: "VERIFIED" | "UNVERIFIED" | "REMOTE" = "VERIFIED";
  let distanceM: number | null = null;
  const hasVenue = config.latitude != null && config.longitude != null;
  if (config.requireDinerLocation && hasVenue) {
    const hasCoords = data.latitude != null && data.longitude != null;
    if (hasCoords) {
      const d = distanceMeters(
        config.latitude!,
        config.longitude!,
        data.latitude!,
        data.longitude!,
      );
      if (d > config.orderRadiusM) {
        await recordAudit(restaurant.id, null, "order.blocked_remote", `${Math.round(d)} m · ${table.label}`);
        return {
          ok: false,
          error: "You need to be at the restaurant to place this order.",
        };
      }
      presence = "VERIFIED";
      distanceM = Math.round(d);
    } else {
      // Diner withheld location — don't block; hold for staff confirmation.
      presence = "UNVERIFIED";
    }
  }

  // Resolve the dining session. Rounds at the same table share one session until
  // the bill is settled; later rounds inherit the diner's name/phone so we don't
  // ask again. A new session id is minted if the client didn't supply one.
  const sessionId = data.sessionId ?? randomUUID();
  let sessionName = data.customerName ?? null;
  let sessionPhone = data.customerPhone ?? null;
  if (data.sessionId && (!sessionName || !sessionPhone)) {
    // Reuse this device's earlier round (by session, regardless of table — the
    // party may have moved tables) so we don't re-ask for name/phone.
    const prior = await prisma.order.findFirst({
      where: { diningSessionId: data.sessionId, restaurantId: restaurant.id },
      orderBy: { createdAt: "desc" },
      select: { customerName: true, customerPhone: true },
    });
    if (prior) {
      sessionName = sessionName ?? prior.customerName;
      sessionPhone = sessionPhone ?? prior.customerPhone;
    }
  }

  // Fetch the real menu items in this order.
  const ids = data.items.map((i) => i.menuItemId);
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: ids }, restaurantId: restaurant.id },
    include: { modifierGroups: { include: { options: true } } },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  const now = new Date();
  // Happy-hour discount applies to the whole line (base + modifiers), checked
  // authoritatively at placement time.
  const hhPercent = happyHourPercentNow(
    {
      enabled: config.happyHourEnabled,
      from: config.happyHourFrom,
      to: config.happyHourTo,
      percent: toNumber(config.happyHourPercent),
    },
    now,
  );
  const hhFactor = hhPercent > 0 ? 1 - hhPercent / 100 : 1;
  type ModSnap = { group: string; name: string; priceDelta: number };
  const lines: {
    menuItemId: string;
    nameSnapshot: string;
    priceSnapshot: number;
    quantity: number;
    notes: string | null;
    lineTotal: number;
    modifiers: ModSnap[] | null;
  }[] = [];
  for (const line of data.items) {
    const mi = byId.get(line.menuItemId);
    if (!mi) return { ok: false, error: "An item is no longer on the menu." };
    if (!mi.isAvailable || !isWithinWindow(mi.availableFrom, mi.availableTo, now)) {
      return { ok: false, error: `"${mi.name}" is currently unavailable.` };
    }

    // Validate & price the chosen modifier options against the real menu.
    const chosen = new Set(line.optionIds ?? []);
    const modifiers: ModSnap[] = [];
    let extra = 0;
    for (const group of mi.modifierGroups) {
      const picked = group.options.filter((o) => chosen.has(o.id));
      if (group.required && picked.length < Math.max(1, group.minSelect)) {
        return { ok: false, error: `Please choose ${group.name} for ${mi.name}.` };
      }
      if (picked.length > group.maxSelect) {
        return { ok: false, error: `Too many options for ${group.name}.` };
      }
      for (const o of picked) {
        if (!o.isAvailable) {
          return { ok: false, error: `"${o.name}" is unavailable.` };
        }
        const delta = toNumber(o.priceDelta);
        extra += delta;
        modifiers.push({ group: group.name, name: o.name, priceDelta: delta });
      }
    }

    const unitPrice =
      Math.round((toNumber(mi.price) + extra) * hhFactor * 100) / 100;
    lines.push({
      menuItemId: mi.id,
      nameSnapshot: mi.name,
      priceSnapshot: unitPrice,
      quantity: line.quantity,
      notes: line.notes ?? null,
      lineTotal: unitPrice * line.quantity,
      modifiers: modifiers.length > 0 ? modifiers : null,
    });
  }

  const totals = computeTotals(
    lines.map((l) => ({ price: l.priceSnapshot, quantity: l.quantity })),
    config.gstMode as GstMode,
    toNumber(config.gstPercentage),
  );

  // Confirmation routing. Presence-unverified orders are always held for a human
  // (PLACED) — they never auto-fire to the kitchen, even at AUTO venues.
  const hold = presence === "UNVERIFIED";
  const autoConfirm = config.orderConfirmation === "AUTO" && !hold;
  const status = autoConfirm ? "CONFIRMED" : "PLACED";

  // Payment intent.
  const payBefore = config.paymentTiming === "PAY_BEFORE";
  const chosen = payBefore ? data.paymentMethod : undefined;
  const needsOnlinePayment = payBefore && chosen === "ONLINE";

  // Link a customer record if a phone is known (this round or an earlier one).
  let customerId: string | null = null;
  if (sessionPhone) {
    const customer = await prisma.customer.upsert({
      where: { phone: sessionPhone },
      create: { phone: sessionPhone, name: sessionName ?? null },
      update: sessionName ? { name: sessionName } : {},
    });
    customerId = customer.id;
  }

  // Aggregate quantities per tracked item for stock decrement.
  const trackedQty = new Map<string, number>();
  for (const l of lines) {
    const mi = byId.get(l.menuItemId);
    if (mi?.trackStock)
      trackedQty.set(l.menuItemId, (trackedQty.get(l.menuItemId) ?? 0) + l.quantity);
  }

  let order: Awaited<ReturnType<typeof prisma.order.create>>;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Decrement stock with a guard so concurrent orders can't oversell.
      for (const [itemId, qty] of trackedQty) {
        const res = await tx.menuItem.updateMany({
          where: { id: itemId, stockQty: { gte: qty } },
          data: { stockQty: { decrement: qty } },
        });
        if (res.count === 0) {
          throw new OutOfStockError(byId.get(itemId)?.name ?? "An item");
        }
      }
      const r = await tx.restaurant.update({
        where: { id: restaurant.id },
        data: { orderSeq: { increment: 1 } },
        select: { orderSeq: true },
      });
      return tx.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: table.id,
        customerId,
        diningSessionId: sessionId,
        orderNumber: r.orderSeq,
        status,
        customerName: sessionName,
        customerPhone: sessionPhone,
        paymentStatus: needsOnlinePayment ? "PENDING" : "UNPAID",
        paymentMethod: chosen ?? null,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        gstMode: config.gstMode,
        notes: data.notes ?? null,
        presence,
        distanceM,
        confirmedAt: autoConfirm ? new Date() : null,
        items: {
          create: lines.map((l) => ({
            menuItemId: l.menuItemId,
            nameSnapshot: l.nameSnapshot,
            priceSnapshot: l.priceSnapshot,
            quantity: l.quantity,
            notes: l.notes,
            lineTotal: l.lineTotal,
            ...(l.modifiers ? { modifiers: l.modifiers } : {}),
          })),
        },
      },
    });
    });
  } catch (e) {
    if (e instanceof OutOfStockError) {
      return {
        ok: false,
        error: `${e.itemName} just sold out — please remove it and try again.`,
      };
    }
    throw e;
  }

  // Low-stock alerts: notify the restaurant when an item crosses its threshold.
  if (trackedQty.size > 0) {
    const after = await prisma.menuItem.findMany({
      where: { id: { in: [...trackedQty.keys()] } },
      select: { id: true, name: true, stockQty: true, lowStockThreshold: true },
    });
    for (const mi of after) {
      const before = mi.stockQty + (trackedQty.get(mi.id) ?? 0);
      if (mi.stockQty <= mi.lowStockThreshold && before > mi.lowStockThreshold) {
        await notifyRestaurant(restaurant.id, {
          title:
            mi.stockQty <= 0 ? `${mi.name} sold out` : `Low stock: ${mi.name}`,
          body: `${mi.stockQty} left`,
          url: "/admin/inventory",
          tag: `stock-${mi.id}`,
        });
      }
    }
  }

  emitEvent({
    type: "order.created",
    restaurantId: restaurant.id,
    orderId: order.id,
    status,
  });

  // Push alert to the restaurant's admin/kitchen devices.
  await notifyRestaurant(restaurant.id, {
    title: `New order #${order.orderNumber}`,
    body: `${table.label} · ${config.currency} ${totals.total.toFixed(2)}${
      sessionName ? ` · ${sessionName}` : ""
    }`,
    url: "/admin/orders",
    tag: "new-order",
  });

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    needsOnlinePayment,
    sessionId,
  };
}
