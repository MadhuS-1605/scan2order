"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin, requireAdminWithPermission } from "@/lib/auth/guards";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyOrderCustomer, notifyRestaurant } from "@/lib/push";
import { awardPointsForOrder } from "@/lib/loyalty";
import { recordAudit } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { round2 } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/orders/status";

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
    await notifyOrderCustomer(order.id, {
      title: `Order #${order.orderNumber} is ready! 🍽️`,
      body: "Your food is ready to be served.",
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
  const { restaurantId } = await requireOnboardedAdmin();
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
  const { restaurantId } = await requireOnboardedAdmin();
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
  const session = await requireOnboardedAdmin();
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
  const { restaurantId } = await requireOnboardedAdmin();
  const orderId = String(formData.get("orderId"));
  const order = await ownedOrder(orderId, restaurantId);

  const sessionOrders = order.tableId
    ? await prisma.order.findMany({
        where: {
          restaurantId,
          tableId: order.tableId,
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
  for (const o of sessionOrders) {
    await prisma.order.update({
      where: { id: o.id },
      data: {
        paymentStatus: "PAID",
        paymentMethod: "COUNTER",
        amountPaid: o.id === primary?.id ? payable : 0,
      },
    });
    await awardPointsForOrder(o.id);
  }
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
