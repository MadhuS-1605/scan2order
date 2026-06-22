import "server-only";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/observability";
import { allowanceForTier, type UsageChannel, type UsageCounts } from "@/lib/plans";
import { effectiveTierOf } from "@/lib/billing/effective-tier";
import { notifyOverageThreshold } from "@/lib/billing/overage-notify";

// Per-tenant usage metering for billable channels (WhatsApp / email). Counts are
// bucketed by calendar month so a tier's monthly allowance maps cleanly to one
// bucket; overage is computed from these counts in src/lib/plans.ts.
//
// recordUsage is fail-soft: a metering hiccup must never break a send, so it
// swallows + logs errors rather than throwing into the messaging path.

// App-side channel keys -> Prisma enum values.
const CHANNEL_DB: Record<UsageChannel, "WHATSAPP" | "EMAIL"> = {
  whatsapp: "WHATSAPP",
  email: "EMAIL",
};

// Calendar-month bucket, "YYYY-MM" in UTC. Stable across server timezones.
export function usagePeriod(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Increment a restaurant's send counter for the current month. Call AFTER a
// successful send so failed/aborted sends aren't billed.
export async function recordUsage(
  restaurantId: string,
  channel: UsageChannel,
  n = 1,
): Promise<void> {
  if (n <= 0) return;
  try {
    const period = usagePeriod();
    const row = await prisma.usageMeter.upsert({
      where: {
        restaurantId_period_channel: {
          restaurantId,
          period,
          channel: CHANNEL_DB[channel],
        },
      },
      create: { restaurantId, period, channel: CHANNEL_DB[channel], count: n },
      update: { count: { increment: n } },
      select: { id: true, count: true, notifiedThreshold: true },
    });
    await maybeNotifyThreshold(restaurantId, channel, row);
  } catch (e) {
    reportError("usage.record", e, { restaurantId, channel });
  }
}

// Alert the owner once per channel/month as usage crosses 80% then 100% of the
// plan allowance. The threshold level is claimed atomically so concurrent sends
// can't double-notify. Fail-soft within recordUsage's try.
async function maybeNotifyThreshold(
  restaurantId: string,
  channel: UsageChannel,
  row: { id: string; count: number; notifiedThreshold: number },
): Promise<void> {
  const allowance = allowanceForTier(await effectiveTierOf(restaurantId))[channel];
  if (!allowance || allowance <= 0) return; // unlimited or no allowance to cross
  const level =
    row.count >= allowance
      ? 100
      : row.count >= Math.ceil(allowance * 0.8)
        ? 80
        : 0;
  if (level <= row.notifiedThreshold) return;
  const claimed = await prisma.usageMeter.updateMany({
    where: { id: row.id, notifiedThreshold: { lt: level } },
    data: { notifiedThreshold: level },
  });
  if (claimed.count === 0) return; // another send claimed it first
  await notifyOverageThreshold(restaurantId, channel, level, row.count, allowance);
}

// This month's usage counts for a restaurant (zero-filled per channel).
export async function currentUsage(restaurantId: string): Promise<UsageCounts> {
  const rows = await prisma.usageMeter.findMany({
    where: { restaurantId, period: usagePeriod() },
    select: { channel: true, count: true },
  });
  const out: UsageCounts = { whatsapp: 0, email: 0 };
  for (const r of rows) {
    if (r.channel === "WHATSAPP") out.whatsapp = r.count;
    else if (r.channel === "EMAIL") out.email = r.count;
  }
  return out;
}
