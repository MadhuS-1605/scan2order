import { prisma } from "@/lib/db";
import { toNumber, modifierSummary } from "@/lib/utils";
import { upiPayLink, isValidVpa } from "@/lib/upi";
import { generateBillPdf } from "@/lib/billing/pdf";
import { round2 as r2 } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await ctx.params; // Next 16: params is async
  const token = new URL(request.url).searchParams.get("t");

  const entry = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, restaurant: { include: { config: true } }, bill: true },
  });
  // Scope access to the scanned table's QR token.
  if (!entry || !entry.restaurant.config || entry.table?.qrToken !== token) {
    return new Response("Not found", { status: 404 });
  }

  // Consolidate the whole dining session (all non-cancelled rounds), matching the
  // on-screen bill. Scoped to the session — not the table — so it aggregates all
  // of this diner's rounds (even across a table move) and never other parties'.
  const orders = entry.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId: entry.restaurantId,
          diningSessionId: entry.diningSessionId,
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
        include: { items: true },
      })
    : [
        await prisma.order.findUniqueOrThrow({
          where: { id: entry.id },
          include: { items: true },
        }),
      ];
  const primary = orders[0];

  const config = entry.restaurant.config;
  const billNumber =
    entry.bill?.billNumber ??
    `INV-${primary.orderNumber}-${primary.id.slice(-5).toUpperCase()}`;

  const items = orders.flatMap((o) =>
    o.items.map((it) => ({
      name:
        it.nameSnapshot +
        (modifierSummary(it.modifiers) ? ` (${modifierSummary(it.modifiers)})` : ""),
      quantity: it.quantity,
      price: toNumber(it.priceSnapshot),
      lineTotal: toNumber(it.lineTotal),
    })),
  );
  const subtotal = r2(orders.reduce((s, o) => s + toNumber(o.subtotal), 0));
  const taxAmount = r2(orders.reduce((s, o) => s + toNumber(o.taxAmount), 0));
  const total = r2(orders.reduce((s, o) => s + toNumber(o.totalAmount), 0));
  const discount = toNumber(primary.discountAmount);
  const tip = toNumber(primary.tipAmount);
  const payable = r2(Math.max(0, total - discount) + tip);

  const paid = primary.paymentStatus === "PAID";
  // QR: a UPI "scan to pay" link when configured & unpaid, else the bill page.
  const origin = new URL(request.url).origin;
  let payUrl = `${origin}/t/${token}/order/${primary.id}/bill`;
  let qrIsUpi = false;
  if (config.upiId && isValidVpa(config.upiId) && !paid && payable > 0) {
    payUrl = upiPayLink({
      vpa: config.upiId,
      name: config.upiName ?? entry.restaurant.name,
      amount: payable,
      note: `Bill #${primary.orderNumber}`,
    });
    qrIsUpi = true;
  }

  const pdf = await generateBillPdf({
    restaurant: {
      name: entry.restaurant.name,
      addressLine: entry.restaurant.addressLine,
      city: entry.restaurant.city,
      state: entry.restaurant.state,
      phone: entry.restaurant.phone,
      gstNumber: config.gstNumber,
      fssaiNumber: entry.restaurant.fssaiNumber,
      logoUrl: entry.restaurant.logoUrl,
    },
    footerMessage: config.billFooterMessage,
    billNumber,
    date: primary.createdAt,
    timezone: config.timezone,
    tableLabel: entry.table
      ? entry.table.kind === "ROOM"
        ? `Room ${entry.table.label}`
        : entry.table.label
      : null,
    customerName: primary.customerName,
    token: orders.map((o) => o.orderNumber).join(", "),
    items,
    subtotal,
    taxAmount,
    total,
    discount,
    couponCode: primary.couponCode,
    tip,
    payable,
    gstMode: primary.gstMode,
    gstPercentage: toNumber(config.gstPercentage),
    paid,
    payUrl,
    qrIsUpi,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="bill-${primary.orderNumber}.pdf"`,
    },
  });
}
