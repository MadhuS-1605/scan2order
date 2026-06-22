import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { toCsv } from "@/lib/csv";
import { toNumber } from "@/lib/utils";
import { platformCan, type PlatformRole } from "@/lib/platform/roles";

export const runtime = "nodejs";

// Platform data exports for super-admins. plan-payments / overage need
// billing.manage; audit needs any super-admin.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ type: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true, platformRole: true },
  });
  if (!me?.isSuperAdmin) return new Response("Unauthorized", { status: 401 });
  const role = me.platformRole as PlatformRole;

  const { type } = await ctx.params;
  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  let csv: string;

  if (type === "plan-payments") {
    if (!platformCan(role, "billing.manage")) return new Response("Forbidden", { status: 403 });
    const rows = await prisma.planPayment.findMany({
      orderBy: { createdAt: "desc" },
      include: { restaurant: { select: { name: true } } },
    });
    csv = toCsv(
      ["Date", "Restaurant", "Tier", "Amount", "Days", "Status", "Razorpay Payment"],
      rows.map((r) => [fmt(r.createdAt), r.restaurant.name, r.tier, toNumber(r.amount), r.periodDays, r.status, r.razorpayPaymentId ?? ""]),
    );
  } else if (type === "overage") {
    if (!platformCan(role, "billing.manage")) return new Response("Forbidden", { status: 403 });
    const rows = await prisma.overageCharge.findMany({
      orderBy: { createdAt: "desc" },
      include: { restaurant: { select: { name: true } } },
    });
    csv = toCsv(
      ["Date", "Restaurant", "Period", "WhatsApp units", "Email units", "Amount", "Status"],
      rows.map((r) => [fmt(r.createdAt), r.restaurant.name, r.period, r.whatsappUnits, r.emailUnits, toNumber(r.amount), r.status]),
    );
  } else if (type === "audit") {
    const rows = await prisma.platformAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5000 });
    const ids = [...new Set(rows.map((r) => r.targetRestaurantId).filter(Boolean) as string[])];
    const names = new Map(
      (await prisma.restaurant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })).map((r) => [r.id, r.name]),
    );
    csv = toCsv(
      ["Date", "Operator", "Action", "Tenant", "Detail"],
      rows.map((r) => [fmt(r.createdAt), r.actorName ?? "", r.action, r.targetRestaurantId ? names.get(r.targetRestaurantId) ?? r.targetRestaurantId : "", r.detail ?? ""]),
    );
  } else {
    return new Response("Unknown export", { status: 404 });
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}.csv"`,
    },
  });
}
