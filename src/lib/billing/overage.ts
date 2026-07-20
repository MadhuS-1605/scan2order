import "server-only";
import { prisma } from "@/lib/db";
import { overageBreakdown, overageCost, withGst, type UsageCounts } from "@/lib/plans";
import { usagePeriod } from "@/lib/usage";
import { effectiveTierOf } from "@/lib/billing/effective-tier";

// Overage settlement engine for metered WhatsApp/email usage.
//
// Model (lazy, no cron): a month becomes billable once it CLOSES (period <
// current month). Outstanding overage is computed live from the meters minus
// months already settled (an OverageCharge row with status PAID). Charges are
// materialised only at settle/bundle time; any non-PAID rows are transient and
// rebuilt on the next attempt, so abandoned checkouts self-heal.
//
// Valuation uses the tier currently in force (effectiveTier) — the same basis
// the billing UI shows. A mid-history tier change would re-value past months at
// the current allowance; acceptable for v1 (documented).

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type OverageMonth = {
  period: string;
  whatsappUnits: number;
  emailUnits: number;
  cost: number; // pre-GST ₹ (per-channel breakdown transparency only — not a charge amount)
};

// `total` is GST-inclusive (sum of each month's cost + 18% GST) — the actual
// amount that will be charged/invoiced, so it matches the settle button and
// the eventual OverageCharge rows exactly (see buildPendingOverageCharges).
export type OutstandingOverage = { total: number; months: OverageMonth[] };

// Unsettled overage across all CLOSED months (read-only; safe in render).
export async function getOutstandingOverage(
  restaurantId: string,
): Promise<OutstandingOverage> {
  const current = usagePeriod();
  const rows = await prisma.usageMeter.findMany({
    where: { restaurantId, period: { lt: current } },
    select: { period: true, channel: true, count: true },
  });
  if (rows.length === 0) return { total: 0, months: [] };

  // Months already paid for are settled forever — never re-bill them.
  const paid = await prisma.overageCharge.findMany({
    where: { restaurantId, status: "PAID" },
    select: { period: true },
  });
  const paidSet = new Set(paid.map((p) => p.period));

  const byPeriod = new Map<string, UsageCounts>();
  for (const r of rows) {
    if (paidSet.has(r.period)) continue;
    const u = byPeriod.get(r.period) ?? { whatsapp: 0, email: 0 };
    if (r.channel === "WHATSAPP") u.whatsapp = r.count;
    else if (r.channel === "EMAIL") u.email = r.count;
    byPeriod.set(r.period, u);
  }

  const tier = await effectiveTierOf(restaurantId);
  const months: OverageMonth[] = [];
  let total = 0;
  for (const [period, u] of byPeriod) {
    const cost = overageCost(u, tier);
    if (cost <= 0) continue;
    const b = overageBreakdown(u, tier);
    months.push({
      period,
      whatsappUnits: b.whatsapp.units,
      emailUnits: b.email.units,
      cost,
    });
    total += withGst(cost); // GST added per month, matching the OverageCharge row it becomes
  }
  months.sort((a, b) => (a.period < b.period ? -1 : 1));
  return { total: round2(total), months };
}

// Materialise PENDING charges for everything outstanding, replacing any prior
// non-PAID rows (so an abandoned attempt doesn't block a fresh one). Returns the
// total ₹ to collect. PAID months are untouched.
export async function buildPendingOverageCharges(
  restaurantId: string,
): Promise<{ total: number }> {
  await prisma.overageCharge.deleteMany({
    where: { restaurantId, status: { not: "PAID" } },
  });
  const { total, months } = await getOutstandingOverage(restaurantId);
  for (const m of months) {
    await prisma.overageCharge.create({
      data: {
        restaurantId,
        period: m.period,
        whatsappUnits: m.whatsappUnits,
        emailUnits: m.emailUnits,
        amount: withGst(m.cost), // GST-inclusive — this row IS the amount charged/invoiced
        status: "PENDING",
      },
    });
  }
  return { total };
}

// Tag the freshly-built PENDING charges with the order they'll be collected by
// (a standalone overage order, or a bundled plan-extend order via planPaymentId).
export async function attachOverageToOrder(
  restaurantId: string,
  razorpayOrderId: string,
  planPaymentId?: string,
): Promise<void> {
  await prisma.overageCharge.updateMany({
    where: { restaurantId, status: "PENDING" },
    data: { razorpayOrderId, ...(planPaymentId ? { planPaymentId } : {}) },
  });
}

// Mark every charge collected by an order PAID (idempotent). Returns whether any
// matched — lets the webhook tell a standalone overage order from other orders.
export async function reconcileOverageByRazorpayOrder(
  razorpayOrderId: string,
  razorpayPaymentId?: string,
  restaurantId?: string, // scope to a tenant on the session-authenticated path
): Promise<{ ok: boolean; amount: number }> {
  const where = {
    razorpayOrderId,
    status: "PENDING" as const,
    ...(restaurantId ? { restaurantId } : {}),
  };
  // Read the rows first so we can report the settled total (idempotent: a second
  // call finds nothing PENDING and reports 0, so callers don't double-notify).
  const pending = await prisma.overageCharge.findMany({
    where,
    select: { amount: true },
  });
  if (pending.length === 0) return { ok: false, amount: 0 };
  await prisma.overageCharge.updateMany({
    where,
    data: { status: "PAID", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) },
  });
  const amount = round2(pending.reduce((s, c) => s + Number(c.amount), 0));
  return { ok: true, amount };
}

// Dev / no-gateway: settle outstanding overage without a real charge.
export async function settleOverageAsPaid(
  restaurantId: string,
): Promise<{ total: number }> {
  const { total } = await buildPendingOverageCharges(restaurantId);
  await prisma.overageCharge.updateMany({
    where: { restaurantId, status: "PENDING" },
    data: { status: "PAID" },
  });
  return { total };
}
