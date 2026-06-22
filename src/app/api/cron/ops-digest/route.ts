import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { notifyOps } from "@/lib/platform/alerts";
import { reportError } from "@/lib/observability";
import { toNumber } from "@/lib/utils";
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

    const [newVenues, failedPlan, failedOverage, overagePaid, totalVenues] = await Promise.all([
      prisma.restaurant.count({ where: { createdAt: { gte: since } } }),
      prisma.planPayment.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
      prisma.overageCharge.count({ where: { status: "FAILED", updatedAt: { gte: since } } }),
      prisma.planPayment.aggregate({ where: { status: "PAID", createdAt: { gte: since } }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.restaurant.count(),
    ]);

    const lines = [
      `New venues (24h): ${newVenues}`,
      `Plan payments (24h): ${overagePaid._count._all} · ${toNumber(overagePaid._sum.amount ?? 0)} collected`,
      `Failed payments (24h): ${failedPlan + failedOverage}`,
      `Total venues: ${totalVenues}`,
    ];
    await notifyOps("Daily ops digest", lines.join("\n"));
    return Response.json({ ok: true });
  } catch (e) {
    reportError("cron.opsDigest", e);
    return new Response("Ops digest failed", { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
