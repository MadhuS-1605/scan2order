import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getSession } from "@/lib/auth/session";
import { planByTier } from "@/lib/plans";
import { toNumber } from "@/lib/utils";
import { generateInvoicePdf, type InvoiceData } from "@/lib/billing/invoice-pdf";

export const runtime = "nodejs";

// Tax invoice for a tenant subscription (kind=plan) or overage (kind=overage)
// payment. Accessible to the owning tenant or any super-admin.
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Not signed in", { status: 401 });
  const { id } = await ctx.params;
  const kind = new URL(request.url).searchParams.get("kind") === "overage" ? "overage" : "plan";

  const restaurantSelect = {
    name: true,
    addressLine: true,
    city: true,
    state: true,
    config: { select: { gstNumber: true, gstLegalName: true } },
  } as const;

  let restaurantId = "";
  let gross = 0;
  let createdAt = new Date();
  let description = "";
  let paymentRef: string | null = null;
  let buyer: InvoiceData["buyer"] = { name: "", gstin: null, address: null };

  if (kind === "plan") {
    const pp = await prisma.planPayment.findUnique({
      where: { id },
      include: { restaurant: { select: restaurantSelect } },
    });
    if (!pp || pp.status !== "PAID") return new Response("Invoice not available", { status: 404 });
    restaurantId = pp.restaurantId;
    gross = toNumber(pp.amount);
    createdAt = pp.createdAt;
    description = `${planByTier(pp.tier).name} plan — ${pp.periodDays} days`;
    paymentRef = pp.razorpayPaymentId;
    buyer = buyerFrom(pp.restaurant);
  } else {
    const oc = await prisma.overageCharge.findUnique({
      where: { id },
      include: { restaurant: { select: restaurantSelect } },
    });
    if (!oc || oc.status !== "PAID") return new Response("Invoice not available", { status: 404 });
    restaurantId = oc.restaurantId;
    gross = toNumber(oc.amount);
    createdAt = oc.createdAt;
    description = `Usage overage — ${oc.period} (${oc.whatsappUnits} WhatsApp, ${oc.emailUnits} emails)`;
    paymentRef = oc.razorpayPaymentId;
    buyer = buyerFrom(oc.restaurant);
  }

  // Authorisation: the owning tenant, or a super-admin.
  if (restaurantId !== session.restaurantId) {
    const u = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { isSuperAdmin: true } });
    if (!u?.isSuperAdmin) return new Response("Forbidden", { status: 403 });
  }

  const pdf = await generateInvoicePdf({
    invoiceNo: `STO-${kind === "overage" ? "OVG" : "SUB"}-${id.slice(-8).toUpperCase()}`,
    date: createdAt,
    seller: {
      name: env.platform.legalName,
      gstin: env.platform.gstin,
      address: env.platform.address,
      email: env.platform.billingEmail,
    },
    buyer,
    lineDescription: description,
    grossAmount: gross,
    paymentRef,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${id.slice(-8)}.pdf"`,
    },
  });
}

function buyerFrom(r: {
  name: string;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  config: { gstNumber: string | null; gstLegalName: string | null } | null;
}): InvoiceData["buyer"] {
  const address = [r.addressLine, [r.city, r.state].filter(Boolean).join(", ")].filter(Boolean).join("\n") || null;
  return {
    name: r.config?.gstLegalName || r.name,
    gstin: r.config?.gstNumber ?? null,
    address,
  };
}
