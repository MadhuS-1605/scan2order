import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/auth/permissions";
import { toCsv } from "@/lib/csv";
import { toNumber, modifierSummary } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ type: string }> },
) {
  const { type } = await ctx.params;
  const session = await getSession();
  if (!session?.restaurantId || !hasPermission(session.role, "analytics")) {
    return new Response("Unauthorized", { status: 401 });
  }
  const rid = session.restaurantId;
  let csv: string;

  if (type === "orders") {
    const orders = await prisma.order.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
      include: { table: true, items: true },
    });
    csv = toCsv(
      ["Order #", "Date", "Table", "Customer", "Phone", "Status", "Payment", "Items", "Subtotal", "Tax", "Discount", "Tip", "Total", "Paid"],
      orders.map((o) => [
        o.orderNumber,
        o.createdAt.toISOString(),
        o.table?.label,
        o.customerName,
        o.customerPhone,
        o.status,
        o.paymentStatus,
        o.items
          .map((i) => {
            const m = modifierSummary(i.modifiers);
            return `${i.quantity}x ${i.nameSnapshot}${m ? ` (${m})` : ""}`;
          })
          .join("; "),
        toNumber(o.subtotal),
        toNumber(o.taxAmount),
        toNumber(o.discountAmount),
        toNumber(o.tipAmount),
        toNumber(o.totalAmount),
        toNumber(o.amountPaid),
      ]),
    );
  } else if (type === "customers") {
    const customers = await prisma.customer.findMany({
      where: { orders: { some: { restaurantId: rid } } },
      include: { _count: { select: { orders: true } } },
    });
    csv = toCsv(
      ["Phone", "Name", "Loyalty points", "Orders", "Joined"],
      customers.map((c) => [
        c.phone,
        c.name,
        c.loyaltyPoints,
        c._count.orders,
        c.createdAt.toISOString(),
      ]),
    );
  } else if (type === "menu") {
    const items = await prisma.menuItem.findMany({
      where: { restaurantId: rid },
      include: { category: true },
      orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
    });
    csv = toCsv(
      ["Name", "Category", "Price", "Description", "Veg", "Available", "Special", "Track stock", "Stock"],
      items.map((i) => [
        i.name,
        i.category?.name,
        toNumber(i.price),
        i.description,
        i.isVeg ? "Yes" : "No",
        i.isAvailable ? "Yes" : "No",
        i.isSpecialOfDay ? "Yes" : "No",
        i.trackStock ? "Yes" : "No",
        i.stockQty,
      ]),
    );
  } else if (type === "feedback") {
    const fb = await prisma.feedback.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
      include: { order: { select: { orderNumber: true } } },
    });
    csv = toCsv(
      ["Date", "Order #", "Rating", "Comment"],
      fb.map((f) => [
        f.createdAt.toISOString(),
        f.order?.orderNumber,
        f.rating,
        f.comment,
      ]),
    );
  } else {
    return new Response("Unknown export type", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-export.csv"`,
    },
  });
}
