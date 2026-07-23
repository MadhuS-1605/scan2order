"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { emitEvent } from "@/lib/realtime/bus";
import { recordAudit } from "@/lib/audit";
import type { Prisma } from "@prisma/client";
import { computeTotals, type GstMode } from "@/lib/pricing";
import { toNumber, happyHourPercentNow } from "@/lib/utils";
import { aggregateRecipeConsumption } from "@/lib/inventory/recipe";

// Effective unit price = base × current happy-hour factor.
function effectivePrice(
  base: number,
  config: {
    happyHourEnabled: boolean;
    happyHourFrom: string | null;
    happyHourTo: string | null;
    happyHourPercent: Prisma.Decimal;
    timezone: string;
  },
): number {
  const pct = happyHourPercentNow(
    {
      enabled: config.happyHourEnabled,
      from: config.happyHourFrom,
      to: config.happyHourTo,
      percent: toNumber(config.happyHourPercent),
    },
    config.timezone,
  );
  return Math.round(base * (1 - pct / 100) * 100) / 100;
}

// Re-sum an order's money from its current line items (after an edit). Takes
// a transaction client so the write can't land separately from the item
// edit/stock adjustment it's summing — see addOrderItemAction/
// setOrderItemQtyAction, which wrap all three in one $transaction.
async function recompute(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true, restaurant: { include: { config: true } } },
  });
  if (!order || !order.restaurant.config) return;
  const totals = computeTotals(
    order.items.map((it) => ({ price: toNumber(it.priceSnapshot), quantity: it.quantity })),
    order.gstMode as GstMode,
    toNumber(order.restaurant.config.gstPercentage),
  );
  await tx.order.update({
    where: { id: orderId },
    data: { subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.total },
  });
}

async function adjustStock(
  tx: Prisma.TransactionClient,
  restaurantId: string,
  menuItemId: string | null,
  delta: number,
) {
  if (!menuItemId || delta === 0) return;
  const mi = await tx.menuItem.findUnique({
    where: { id: menuItemId },
    select: {
      trackStock: true,
      recipeLines: {
        select: { ingredientId: true, qtyPerServing: true, ingredient: { select: { costPerUnit: true } } },
      },
    },
  });
  if (!mi) return;
  if (mi.trackStock) {
    await tx.menuItem.update({
      where: { id: menuItemId },
      data: { stockQty: { increment: -delta } }, // +delta items ordered => stock down
    });
  }
  // Recipe ingredients follow the same delta — never blocks the edit, just
  // keeps ingredient stock consistent with what's actually been ordered.
  for (const r of mi.recipeLines) {
    const qty = delta * toNumber(r.qtyPerServing);
    await tx.ingredient.update({
      where: { id: r.ingredientId },
      data: { stockQty: { decrement: qty } },
    });
    await tx.ingredientLedgerEntry.create({
      data: {
        restaurantId,
        ingredientId: r.ingredientId,
        delta: -qty,
        reason: "ORDER_CONSUMPTION",
        costPerUnit: toNumber(r.ingredient.costPerUnit),
      },
    });
  }
}

// Waiter places an order on a guest's behalf.
export async function createStaffOrderAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const tableId = String(formData.get("tableId") ?? "");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  let lines: { menuItemId: string; quantity: number; notes?: string }[] = [];
  try {
    lines = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    lines = [];
  }
  lines = lines.filter((l) => l.menuItemId && l.quantity > 0);
  if (lines.length === 0) return;

  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: session.restaurantId },
    include: { restaurant: { include: { config: true } } },
  });
  if (!table || !table.restaurant.config) return;
  const config = table.restaurant.config;

  const items = await prisma.menuItem.findMany({
    where: { id: { in: lines.map((l) => l.menuItemId) }, restaurantId: session.restaurantId },
    include: { recipeLines: { include: { ingredient: { select: { costPerUnit: true } } } } },
  });
  const byId = new Map(items.map((m) => [m.id, m]));

  const built: {
    menuItemId: string;
    nameSnapshot: string;
    priceSnapshot: number;
    quantity: number;
    lineTotal: number;
    notes: string | null;
    trackStock: boolean;
  }[] = [];
  for (const l of lines) {
    const mi = byId.get(l.menuItemId);
    if (!mi) continue;
    const unit = effectivePrice(toNumber(mi.price), config);
    built.push({
      menuItemId: mi.id,
      nameSnapshot: mi.name,
      priceSnapshot: unit,
      quantity: l.quantity,
      lineTotal: Math.round(unit * l.quantity * 100) / 100,
      notes: l.notes?.slice(0, 200) || null,
      trackStock: mi.trackStock,
    });
  }
  if (built.length === 0) return;

  const totals = computeTotals(
    built.map((b) => ({ price: b.priceSnapshot, quantity: b.quantity })),
    config.gstMode as GstMode,
    toNumber(config.gstPercentage),
  );

  const recipesByItem = new Map(
    items.map((m) => [m.id, m.recipeLines.map((r) => ({ ingredientId: r.ingredientId, qtyPerServing: toNumber(r.qtyPerServing) }))]),
  );
  const ingredientConsumption = aggregateRecipeConsumption(
    built.map((b) => ({ menuItemId: b.menuItemId, quantity: b.quantity })),
    recipesByItem,
  );
  const costByIngredient = new Map(
    items.flatMap((m) => m.recipeLines.map((r) => [r.ingredientId, toNumber(r.ingredient.costPerUnit)] as const)),
  );

  const order = await prisma.$transaction(async (tx) => {
    for (const b of built) {
      if (b.trackStock) {
        await tx.menuItem.update({
          where: { id: b.menuItemId },
          data: { stockQty: { decrement: b.quantity } },
        });
      }
    }
    for (const [ingredientId, qty] of ingredientConsumption) {
      await tx.ingredient.update({ where: { id: ingredientId }, data: { stockQty: { decrement: qty } } });
      await tx.ingredientLedgerEntry.create({
        data: {
          restaurantId: session.restaurantId,
          ingredientId,
          delta: -qty,
          reason: "ORDER_CONSUMPTION",
          costPerUnit: costByIngredient.get(ingredientId) ?? null,
        },
      });
    }
    const r = await tx.restaurant.update({
      where: { id: session.restaurantId },
      data: { orderSeq: { increment: 1 } },
      select: { orderSeq: true },
    });
    return tx.order.create({
      data: {
        restaurantId: session.restaurantId,
        tableId: table.id,
        orderNumber: r.orderSeq,
        status: "CONFIRMED",
        channel: "STAFF",
        createdById: session.sub,
        createdByName: session.name,
        customerName: customerName || null,
        notes: notes || null,
        paymentStatus: "UNPAID",
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        gstMode: config.gstMode,
        confirmedAt: new Date(),
        items: {
          create: built.map((b) => ({
            menuItemId: b.menuItemId,
            nameSnapshot: b.nameSnapshot,
            priceSnapshot: b.priceSnapshot,
            quantity: b.quantity,
            lineTotal: b.lineTotal,
            notes: b.notes,
          })),
        },
      },
    });
  });

  emitEvent({ type: "order.created", restaurantId: session.restaurantId, orderId: order.id, status: "CONFIRMED" });
  await recordAudit(session.restaurantId, session, "order.staff_created", `#${order.orderNumber} · ${table.label}`);
  redirect(`/admin/orders/${order.id}`);
}

// Loads an editable (unpaid, open) order scoped to the admin's restaurant.
async function editableOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { restaurant: { include: { config: true } } },
  });
  if (!order) return null;
  if (order.paymentStatus === "PAID" || order.status === "CANCELLED") return null;
  return order;
}

export async function addOrderItemAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const orderId = String(formData.get("orderId") ?? "");
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);

  const order = await editableOrder(orderId, session.restaurantId);
  const mi = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId: session.restaurantId },
  });
  if (!order || !order.restaurant.config || !mi) return;

  const unit = effectivePrice(toNumber(mi.price), order.restaurant.config);
  // Item write + stock/ingredient-ledger adjustment + totals recompute as one
  // unit: a failure partway through (e.g. an ingredient deleted by another
  // admin mid-request) must not leave the order's line items out of sync
  // with its own subtotal/tax/total.
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.create({
      data: {
        orderId: order.id,
        menuItemId: mi.id,
        nameSnapshot: mi.name,
        priceSnapshot: unit,
        quantity,
        lineTotal: Math.round(unit * quantity * 100) / 100,
      },
    });
    await adjustStock(tx, session.restaurantId, mi.id, quantity);
    await recompute(tx, order.id);
  });
  emitEvent({ type: "order.updated", restaurantId: session.restaurantId, orderId: order.id });
  await recordAudit(
    session.restaurantId,
    session,
    "order.item_added",
    `#${order.orderNumber} · ${mi.name} ×${quantity}`,
  );
  revalidatePath(`/admin/orders/${order.id}`);
}

// Change a line's quantity (0 removes it). Restores/consumes stock by the delta.
export async function setOrderItemQtyAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const orderItemId = String(formData.get("orderItemId") ?? "");
  const quantity = Math.max(0, Number(formData.get("quantity") ?? 0) || 0);

  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    include: { order: true },
  });
  if (!item || item.order.restaurantId !== session.restaurantId) return;
  const order = await editableOrder(item.orderId, session.restaurantId);
  if (!order) return;

  const delta = quantity - item.quantity;
  await prisma.$transaction(async (tx) => {
    if (quantity <= 0) {
      await tx.orderItem.delete({ where: { id: item.id } });
    } else {
      const unit = toNumber(item.priceSnapshot);
      await tx.orderItem.update({
        where: { id: item.id },
        data: { quantity, lineTotal: Math.round(unit * quantity * 100) / 100 },
      });
    }
    await adjustStock(tx, session.restaurantId, item.menuItemId, delta);
    await recompute(tx, order.id);
  });
  emitEvent({ type: "order.updated", restaurantId: session.restaurantId, orderId: order.id });
  await recordAudit(
    session.restaurantId,
    session,
    "order.item_qty",
    `#${order.orderNumber} · ${item.nameSnapshot} ${quantity <= 0 ? "removed" : `×${quantity}`}`,
  );
  revalidatePath(`/admin/orders/${order.id}`);
}
