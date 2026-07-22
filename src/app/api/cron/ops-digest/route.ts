import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { notifyOps } from "@/lib/platform/alerts";
import { reportError } from "@/lib/observability";
import { toNumber, formatMoney } from "@/lib/utils";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";

// Daily operator digest: yesterday's signups, failed payments, lapses, and
// overage collected. Point a daily scheduler at this URL with the cron secret.
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });
  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  try {
    const since = new Date();
    since.setDate(since.getDate() - 1);

    const in7Days = new Date(Date.now() + 7 * 86_400_000);
    const [newVenues, failedPlan, failedOverage, overagePaid, totalVenues, dueVendorBills, deliveryAttempts, deliveryFailures] = await Promise.all([
      prisma.restaurant.count({ where: { createdAt: { gte: since } } }),
      prisma.planPayment.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
      prisma.overageCharge.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
      prisma.planPayment.aggregate({ where: { status: "PAID", createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.restaurant.count(),
      prisma.platformSubscription.findMany({
        where: { isActive: true, billingCycle: { not: "ONE_TIME" }, nextRenewalAt: { lte: in7Days } },
        orderBy: { nextRenewalAt: "asc" },
      }),
      prisma.messageDeliveryLog.count({ where: { createdAt: { gte: since }, mocked: false } }),
      prisma.messageDeliveryLog.count({ where: { createdAt: { gte: since }, mocked: false, ok: false } }),
    ]);

    const lines = [
      `New venues (24h): ${newVenues}`,
      `Plan payments (24h): ${overagePaid._count._all} · ${toNumber(overagePaid._sum.amount ?? 0)} collected`,
      `Failed payments (24h): ${failedPlan + failedOverage}`,
      `Total venues: ${totalVenues}`,
    ];
    if (dueVendorBills.length) {
      lines.push("");
      lines.push(`Vendor bills due within 7 days (${dueVendorBills.length}):`);
      for (const b of dueVendorBills) {
        const overdue = b.nextRenewalAt < new Date();
        lines.push(
          `  ${b.vendor} — ${formatMoney(b.amount, b.currency)} — ${b.nextRenewalAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}${overdue ? " (OVERDUE)" : ""}`,
        );
      }
    }
    if (deliveryFailures > 0) {
      const pct = deliveryAttempts ? Math.round((deliveryFailures / deliveryAttempts) * 100) : 0;
      lines.push("");
      lines.push(`Messaging failures (24h): ${deliveryFailures}/${deliveryAttempts} (${pct}%) — see Health page for breakdown.`);
    }
    await notifyOps("Daily ops digest", lines.join("\n"));
    return Response.json({ ok: true });
  } catch (e) {
    reportError("cron.opsDigest", e);
    // If notifyOps itself is what's down (e.g. Slack webhook), this alert
    // silently fails too — reportError/Sentry is the backstop for that case.
    await notifyOps("Ops digest cron failed", `The daily ops digest query/send failed: ${e instanceof Error ? e.message : String(e)}`);
    return new Response("Ops digest failed", { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
