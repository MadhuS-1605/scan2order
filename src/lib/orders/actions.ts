"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin, requireAdminWithPermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyOrderCustomer, notifyRestaurant } from "@/lib/push";
import { awardPointsForOrder } from "@/lib/loyalty";
import { recordAudit } from "@/lib/audit";
import { toNumber, formatMoney } from "@/lib/utils";
import { round2 } from "@/lib/pricing";
import {
  resolveRazorpayCreds,
  refundRazorpayPayment,
} from "@/lib/payments/razorpay";
import { refundableAmount, clampRefund } from "@/lib/billing/refund-math";
import type { OrderStatus } from "@/lib/orders/status";

export type RefundResult =
  | { ok: true; amount: number; pending?: boolean }
  | { ok: false; error: string };

async function ownedOrder(orderId: string, restaurantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { table: true },
  });
  if (!order) throw new Error("Order not found");
  return order;
}

type OwnedOrder = Awaited<ReturnType<typeof ownedOrder>>;

// Push a status alert to the diner's device for milestone statuses.
async function notifyCustomer(order: OwnedOrder, status: OrderStatus) {
  if (!order.table) return;
  const url = `/t/${order.table.qrToken}/order/${order.id}`;
  const tag = `order-${order.id}`;
  if (status === "CONFIRMED") {
    await notifyOrderCustomer(order.id, {
      title: `Order #${order.orderNumber} confirmed`,
      body: "The kitchen is preparing your food.",
      url,
      tag,
    });
  } else if (status === "READY") {
    // Self-service (counter) venues = pickup; table/room venues = served.
    const pickup = order.table.kind === "COUNTER";
    await notifyOrderCustomer(order.id, {
      title: `Order #${order.orderNumber} is ready! 🍽️`,
      body: pickup
        ? "Please collect it at the counter."
        : "Your food is ready to be served.",
      url,
      tag,
    });
  }
}

function timestampFor(status: OrderStatus): Record<string, Date> {
  switch (status) {
    case "CONFIRMED":
      return { confirmedAt: new Date() };
    case "READY":
      return { readyAt: new Date() };
    case "SERVED":
      return { servedAt: new Date() };
    case "COMPLETED":
      return { closedAt: new Date() };
    default:
      return {};
  }
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  revalidatePath("/admin/analytics");
}

export async function setOrderStatusAction(formData: FormData): Promise<void> {
  // Progressing an order is done from the orders board (orders) AND the kitchen
  // screen (kitchen) — allow either, reject roles with neither.
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "orders") && !hasPermission(session.role, "kitchen")) {
    throw new Error("You don't have permission for this action.");
  }
  const { restaurantId } = session;
  const orderId = String(formData.get("orderId"));
  const status = String(formData.get("status")) as OrderStatus;

  const order = await ownedOrder(orderId, restaurantId);
  await prisma.order.update({
    where: { id: orderId },
    data: { status, ...timestampFor(status) },
  });

  emitEvent({ type: "order.status", restaurantId, orderId, status });
  await notifyCustomer(order, status);
  revalidateAdmin();
}

export async function confirmOrderAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("orders");
  const orderId = String(formData.get("orderId"));
  const order = await ownedOrder(orderId, restaurantId);
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  emitEvent({
    type: "order.status",
    restaurantId,
    orderId,
    status: "CONFIRMED",
  });
  await notifyCustomer(order, "CONFIRMED");
  revalidateAdmin();
}

export async function rejectOrderAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const { restaurantId } = session;
  const orderId = String(formData.get("orderId"));
  const order = await ownedOrder(orderId, restaurantId);
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "CANCELLED" },
  });
  emitEvent({
    type: "order.status",
    restaurantId,
    orderId,
    status: "CANCELLED",
  });

  // Refund signal: if money was already collected on this table's bill,
  // cancelling means a refund is likely owed — make it visible to staff.
  const paid = order.tableId
    ? toNumber(
        (
          await prisma.order.aggregate({
            where: {
              restaurantId,
              tableId: order.tableId,
              status: { not: "CANCELLED" },
            },
            _sum: { amountPaid: true },
          })
        )._sum.amountPaid ?? 0,
      )
    : toNumber(order.amountPaid);
  if (paid > 0) {
    await recordAudit(
      restaurantId,
      session,
      "order.refund_due",
      `#${order.orderNumber} cancelled · ${paid} paid on table`,
    );
    await notifyRestaurant(restaurantId, {
      title: "Refund may be due",
      body: `Order #${order.orderNumber} was cancelled after payment.`,
      url: "/admin/orders",
      tag: "refund-due",
    });
  }
  revalidateAdmin();
}

// Marks a counter (offline) payment as collected. Settles the whole table bill
// (all open rounds at the table, any device/staff), since billing is table-based.
export async function markPaidAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("orders");
  const orderId = String(formData.get("orderId"));
  const order = await ownedOrder(orderId, restaurantId);

  // Settle the diner's dining session (their consolidated bill), not the whole
  // table — so separate parties at a shared table are billed independently and
  // this matches what the diner sees/pays. Sessionless POS orders settle alone.
  const sessionOrders = order.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId,
          diningSessionId: order.diningSessionId,
          status: { not: "CANCELLED" },
          paymentStatus: { not: "PAID" },
        },
        orderBy: { createdAt: "asc" },
      })
    : [order];

  // Consolidated bill: the primary (earliest) order carries discount/tip and
  // the full payable; the rest settle at 0 so SUM(amountPaid) stays accurate.
  const primary = sessionOrders[0];
  const totalSum = sessionOrders.reduce((s, o) => s + toNumber(o.totalAmount), 0);
  const payable = round2(
    Math.max(0, totalSum - toNumber(primary?.discountAmount ?? 0)) +
      toNumber(primary?.tipAmount ?? 0),
  );
  // Pay-first venues hold the order out of the kitchen until paid — taking the
  // counter payment here releases it (PLACED -> CONFIRMED).
  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { requirePrepayment: true },
  });
  const confirmOnPay = cfg?.requirePrepayment ?? false;
  for (const o of sessionOrders) {
    const justConfirmed = confirmOnPay && o.status === "PLACED";
    await prisma.order.update({
      where: { id: o.id },
      data: {
        paymentStatus: "PAID",
        paymentMethod: "COUNTER",
        amountPaid: o.id === primary?.id ? payable : 0,
        ...(justConfirmed ? { status: "CONFIRMED", confirmedAt: new Date() } : {}),
      },
    });
    if (justConfirmed) {
      emitEvent({ type: "order.created", restaurantId, orderId: o.id, status: "CONFIRMED" });
    }
    await awardPointsForOrder(o.id);
  }
  revalidateAdmin();
}

// Bar KDS: tick a drink item as prepared (or undo). Per-item ack that's
// independent of the overall order status, so the bar can pour without
// touching the kitchen's flow. Gated by the kitchen permission (the bar board).
export async function toggleItemPreparedAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("kitchen");
  const itemId = String(formData.get("itemId"));
  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, order: { restaurantId } },
    select: { id: true, preparedAt: true, orderId: true },
  });
  if (!item) return;
  await prisma.orderItem.update({
    where: { id: item.id },
    data: { preparedAt: item.preparedAt ? null : new Date() },
  });
  emitEvent({ type: "order.updated", restaurantId, orderId: item.orderId });
  revalidatePath("/admin/bar");
}

// Attempts the actual money movement for a refund: Razorpay for online
// payments, a no-op (manual/counter) otherwise. Shared by the direct
// (OWNER/MANAGER) path and the manager-approval path below, so there's one
// place that ever calls the gateway.
async function chargeRefundToGateway(
  order: {
    payments: { razorpayPaymentId: string | null }[];
    restaurant: { config: { razorpayKeyId: string | null; razorpayKeySecret: string | null } | null };
  },
  method: string,
  amount: number,
): Promise<{ ok: true; gatewayRefundId: string | null } | { ok: false }> {
  if (method !== "ONLINE") return { ok: true, gatewayRefundId: null };
  const pay = order.payments.find((p) => p.razorpayPaymentId);
  const creds = order.restaurant.config ? resolveRazorpayCreds(order.restaurant.config) : null;
  if (!pay?.razorpayPaymentId || !creds) return { ok: false };
  try {
    const res = await refundRazorpayPayment(creds, pay.razorpayPaymentId, amount);
    return { ok: true, gatewayRefundId: res.id };
  } catch {
    return { ok: false };
  }
}

// Staff-initiated refund. Full or partial. OWNER/MANAGER (permission
// "refunds") execute immediately: online payments return via Razorpay using
// the captured payment id, counter/cash refunds are a manual note. Anyone
// else with "requestRefunds" (CASHIER/WAITER) instead creates a PENDING
// record — no money moves until a manager approves it below. The order flips
// to REFUNDED once fully refunded. Refunds target the order that holds the
// payment (the bill's primary order, where amountPaid > 0).
export async function refundOrderAction(formData: FormData): Promise<RefundResult> {
  const session = await requireOnboardedAdmin();
  const canExecute = hasPermission(session.role, "refunds");
  const canRequest = canExecute || hasPermission(session.role, "requestRefunds");
  if (!canRequest) throw new Error("You don't have permission for this action.");
  const { restaurantId } = session;
  const orderId = String(formData.get("orderId"));
  const reason = String(formData.get("reason") ?? "").trim() || null;

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: {
      payments: true,
      refunds: true,
      restaurant: { include: { config: true } },
    },
  });
  if (!order) return { ok: false, error: "Order not found." };

  const paid = toNumber(order.amountPaid);
  const refundable = refundableAmount(
    paid,
    order.refunds.map((r) => ({ amount: toNumber(r.amount), status: r.status })),
  );
  if (refundable <= 0) {
    return { ok: false, error: "Nothing left to refund on this order." };
  }
  const amount = clampRefund(Number(formData.get("amount")), refundable);
  if (amount <= 0) return { ok: false, error: "Enter a valid refund amount." };
  const already = round2(paid - refundable);

  const method = order.paymentMethod ?? "COUNTER";
  const currency = order.restaurant.config?.currency ?? "INR";

  if (!canExecute) {
    await prisma.refund.create({
      data: { restaurantId, orderId, amount, reason, method, status: "PENDING", createdByName: session.name },
    });
    await notifyRestaurant(restaurantId, {
      title: "Refund needs approval",
      body: `#${order.orderNumber} · ${formatMoney(amount, currency)}${reason ? ` · ${reason}` : ""}`,
      url: "/admin/refunds",
      tag: `refund-pending-${orderId}`,
    });
    await recordAudit(
      restaurantId,
      session,
      "order.refund_requested",
      `#${order.orderNumber} · ${formatMoney(amount, currency)}${reason ? ` · ${reason}` : ""}`,
    );
    revalidateAdmin();
    return { ok: true, amount, pending: true };
  }

  if (method === "ONLINE") {
    const pay = order.payments.find((p) => p.razorpayPaymentId);
    const creds = order.restaurant.config ? resolveRazorpayCreds(order.restaurant.config) : null;
    if (!pay?.razorpayPaymentId || !creds) {
      return {
        ok: false,
        error: "No online payment on file to refund — record a manual refund instead.",
      };
    }
  }
  const charged = await chargeRefundToGateway(order, method, amount);
  if (!charged.ok) {
    await prisma.refund.create({
      data: { restaurantId, orderId, amount, reason, method, status: "FAILED", createdByName: session.name },
    });
    await recordAudit(restaurantId, session, "order.refund_failed", `#${order.orderNumber} · ${formatMoney(amount, currency)}`);
    return { ok: false, error: "The payment gateway rejected the refund. Try again, or refund manually." };
  }

  await prisma.refund.create({
    data: {
      restaurantId,
      orderId,
      amount,
      reason,
      method,
      gatewayRefundId: charged.gatewayRefundId,
      status: "DONE",
      createdByName: session.name,
    },
  });
  if (round2(already + amount) >= paid) {
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: "REFUNDED" } });
  }
  await recordAudit(
    restaurantId,
    session,
    "order.refunded",
    `#${order.orderNumber} · ${formatMoney(amount, currency)}${reason ? ` · ${reason}` : ""}`,
  );
  emitEvent({ type: "order.updated", restaurantId, orderId });
  revalidateAdmin();
  return { ok: true, amount };
}

// Manager approves a PENDING refund request: charges the gateway (if online)
// and flips it to DONE, exactly like a direct refund would have.
export async function approveRefundAction(formData: FormData): Promise<RefundResult> {
  const session = await requireAdminWithPermission("refunds");
  const { restaurantId } = session;
  const refundId = String(formData.get("refundId"));

  const pending = await prisma.refund.findFirst({
    where: { id: refundId, restaurantId, status: "PENDING" },
    include: {
      order: {
        include: { payments: true, refunds: true, restaurant: { include: { config: true } } },
      },
    },
  });
  if (!pending) return { ok: false, error: "This request is no longer pending." };
  const order = pending.order;

  // Re-validate against what's refundable now — another refund may have
  // landed since this was requested.
  const paid = toNumber(order.amountPaid);
  const refundable = refundableAmount(
    paid,
    order.refunds.map((r) => ({ amount: toNumber(r.amount), status: r.status })),
  );
  const amount = clampRefund(toNumber(pending.amount), refundable);
  const currency = order.restaurant.config?.currency ?? "INR";
  if (amount <= 0) {
    await prisma.refund.update({
      where: { id: refundId },
      data: { status: "REJECTED", approvedByName: session.name },
    });
    return { ok: false, error: "Nothing left to refund on this order — request auto-declined." };
  }

  const charged = await chargeRefundToGateway(order, pending.method, amount);
  if (!charged.ok) {
    await prisma.refund.update({
      where: { id: refundId },
      data: { status: "FAILED", approvedByName: session.name },
    });
    return { ok: false, error: "The payment gateway rejected the refund. Try again, or refund manually." };
  }

  await prisma.refund.update({
    where: { id: refundId },
    data: { status: "DONE", amount, gatewayRefundId: charged.gatewayRefundId, approvedByName: session.name },
  });
  const already = round2(paid - refundable);
  if (round2(already + amount) >= paid) {
    await prisma.order.update({ where: { id: order.id }, data: { paymentStatus: "REFUNDED" } });
  }
  await recordAudit(
    restaurantId,
    session,
    "order.refund_approved",
    `#${order.orderNumber} · ${formatMoney(amount, currency)}`,
  );
  emitEvent({ type: "order.updated", restaurantId, orderId: order.id });
  revalidateAdmin();
  return { ok: true, amount };
}

// Manager declines a PENDING refund request — no money moves.
export async function rejectRefundAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("refunds");
  const refundId = String(formData.get("refundId"));
  const refund = await prisma.refund.findFirst({
    where: { id: refundId, restaurantId: session.restaurantId, status: "PENDING" },
    include: { order: true },
  });
  if (!refund) return;
  await prisma.refund.update({
    where: { id: refundId },
    data: { status: "REJECTED", approvedByName: session.name },
  });
  await recordAudit(
    session.restaurantId,
    session,
    "order.refund_rejected",
    `#${refund.order.orderNumber} · ${formatMoney(toNumber(refund.amount), "INR")}`,
  );
  revalidateAdmin();
}

// Waiter moves an order (or the whole party) to a different table. With
// table-based billing, this re-consolidates the bill onto the new table.
export async function changeOrderTableAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const { restaurantId } = session;
  const orderId = String(formData.get("orderId"));
  const newTableId = String(formData.get("newTableId"));
  const scope = String(formData.get("scope") ?? "all");

  const order = await ownedOrder(orderId, restaurantId);
  const newTable = await prisma.restaurantTable.findFirst({
    where: { id: newTableId, restaurantId },
  });
  if (!newTable || newTable.id === order.tableId) return;
  const fromLabel = order.table?.label ?? "—";

  if (scope === "single" || !order.tableId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { tableId: newTableId },
    });
  } else {
    // Whole party: every open order currently at the order's table.
    await prisma.order.updateMany({
      where: {
        restaurantId,
        tableId: order.tableId,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
      },
      data: { tableId: newTableId },
    });
  }

  emitEvent({ type: "order.updated", restaurantId, orderId: order.id });
  await recordAudit(
    restaurantId,
    session,
    "order.table_changed",
    `${fromLabel} → ${newTable.label}${scope === "single" ? ` (#${order.orderNumber})` : ""}`,
  );
  revalidateAdmin();
}

// Clears a table after a walk-out: voids every open (non-cancelled, unpaid)
// order at the table so the bill closes and the next party starts fresh. Cash
// settle uses markPaidAction instead.
export async function clearTableAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const { restaurantId } = session;
  const tableId = String(formData.get("tableId") ?? "");
  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId },
    select: { id: true, label: true },
  });
  if (!table) return;

  const res = await prisma.order.updateMany({
    where: {
      restaurantId,
      tableId: table.id,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
    },
    data: { status: "CANCELLED" },
  });
  if (res.count === 0) return;

  emitEvent({ type: "order.status", restaurantId, status: "CANCELLED" });
  await recordAudit(
    restaurantId,
    session,
    "table.cleared",
    `${table.label} · ${res.count} order${res.count > 1 ? "s" : ""} voided (walk-out)`,
  );
  revalidateAdmin();
}
