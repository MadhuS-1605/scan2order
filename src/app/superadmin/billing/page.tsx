import Link from "next/link";
import { IndianRupee, TrendingUp, Repeat, Hourglass, AlertTriangle, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { planByTier } from "@/lib/plans";
import { resolvePlans } from "@/lib/plan-settings";
import { subscriptionState } from "@/lib/subscription";
import { usagePeriod } from "@/lib/usage";
import { formatMoney, toNumber } from "@/lib/utils";

export default async function PlatformBillingPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "billing.manage")) redirect("/superadmin");
  const start30 = new Date();
  start30.setDate(start30.getDate() - 30);
  const period = usagePeriod();

  const [restaurants, planPaidAll, planPaid30, overagePaidAll, recentPayments, usageRows] =
    await Promise.all([
      prisma.restaurant.findMany({
        select: { id: true, name: true, planTier: true, planActiveUntil: true, planIsTrial: true },
      }),
      prisma.planPayment.aggregate({ where: { status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
      prisma.planPayment.aggregate({ where: { status: "PAID", createdAt: { gte: start30 } }, _sum: { amount: true } }),
      prisma.overageCharge.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
      prisma.planPayment.findMany({
        where: { status: "PAID" },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { restaurant: { select: { id: true, name: true } } },
      }),
      prisma.usageMeter.groupBy({ by: ["restaurantId"], where: { period }, _sum: { count: true } }),
    ]);

  // MRR = monthly price of every actively-paying (non-trial) subscription.
  // Use operator-set prices so MRR matches what's actually charged.
  const resolved = await resolvePlans();
  const priceByTier = new Map<string, number>(resolved.map((p) => [p.tier, p.price]));
  const mrrByTier = new Map<string, { count: number; mrr: number }>();
  let trials = 0;
  let trialsExpiring = 0;
  let lapsed = 0;
  for (const r of restaurants) {
    const sub = subscriptionState(r);
    if (sub.status === "ACTIVE") {
      const price = priceByTier.get(sub.tier) ?? planByTier(sub.tier).price;
      const cur = mrrByTier.get(sub.tier) ?? { count: 0, mrr: 0 };
      cur.count += 1;
      cur.mrr += price;
      mrrByTier.set(sub.tier, cur);
    } else if (sub.status === "TRIAL") {
      trials += 1;
      if ((sub.daysLeft ?? 99) <= 7) trialsExpiring += 1;
    } else if (sub.status === "EXPIRED") {
      lapsed += 1;
    }
  }
  const mrr = [...mrrByTier.values()].reduce((s, v) => s + v.mrr, 0);
  const activeSubs = [...mrrByTier.values()].reduce((s, v) => s + v.count, 0);

  // Top usage tenants this month.
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));
  const usageLeaders = usageRows
    .map((u) => ({ id: u.restaurantId, sends: u._sum.count ?? 0, name: nameById.get(u.restaurantId) ?? "—" }))
    .sort((a, b) => b.sends - a.sends)
    .slice(0, 5);

  const stat = (label: string, value: string, sub: string, Icon: typeof IndianRupee) => (
    <div className="rounded-2xl border border-sand-200 bg-surface p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-0.5 text-xl font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink/40">{sub}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Revenue & subscriptions</h1>
          <p className="text-sm text-ink/45">
            Platform subscription revenue — distinct from tenant (diner) GMV on the console.
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/api/superadmin/export/plan-payments" target="_blank" rel="noopener" className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100">Export payments</a>
          <a href="/api/superadmin/export/overage" target="_blank" rel="noopener" className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100">Export overage</a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stat("MRR", formatMoney(mrr), `${activeSubs} active subscriptions`, Repeat)}
        {stat("ARR", formatMoney(mrr * 12), "annualised run-rate", TrendingUp)}
        {stat("Plan revenue", formatMoney(toNumber(planPaidAll._sum.amount ?? 0)), `${planPaidAll._count._all} payments all-time`, IndianRupee)}
        {stat("Last 30 days", formatMoney(toNumber(planPaid30._sum.amount ?? 0)), "plan payments", TrendingUp)}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stat("Trials", String(trials), `${trialsExpiring} expiring ≤7 days`, Hourglass)}
        {stat("Lapsed", String(lapsed), "expired → Free limits", AlertTriangle)}
        {stat("Overage collected", formatMoney(toNumber(overagePaidAll._sum.amount ?? 0)), "all-time, paid", MessageSquare)}
        {stat("Active venues", String(restaurants.length), "total tenants", IndianRupee)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* MRR by tier */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">MRR by plan</h2>
          <ul className="space-y-2">
            {resolved.filter((p) => p.price > 0).map((p) => {
              const v = mrrByTier.get(p.tier) ?? { count: 0, mrr: 0 };
              const pct = mrr ? Math.round((v.mrr / mrr) * 100) : 0;
              return (
                <li key={p.tier}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink/70">{p.name} <span className="text-ink/40">· {v.count}</span></span>
                    <span className="font-medium text-ink">{formatMoney(v.mrr)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Usage leaders */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">Top usage this month</h2>
          {usageLeaders.length === 0 ? (
            <p className="text-sm text-ink/45">No metered sends yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {usageLeaders.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/superadmin/restaurants/${u.id}`} className="min-w-0 truncate font-medium text-ink hover:text-brand-600 hover:underline">
                    {u.name}
                  </Link>
                  <span className="shrink-0 text-ink/55">{u.sends.toLocaleString("en-IN")} sends</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent plan payments */}
      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Restaurant</th>
              <th className="px-4 py-2.5">Plan</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Date</th>
              <th className="px-4 py-2.5">Invoice</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {recentPayments.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink/45">No plan payments yet.</td></tr>
            ) : (
              recentPayments.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/superadmin/restaurants/${p.restaurant.id}`} className="font-medium text-ink hover:text-brand-600 hover:underline">
                      {p.restaurant.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink/70">{p.tier}</td>
                  <td className="px-4 py-2.5 text-ink/70">{formatMoney(toNumber(p.amount))}</td>
                  <td className="px-4 py-2.5 text-ink/55">
                    {p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5">
                    <a href={`/api/billing/invoice/${p.id}?kind=plan`} target="_blank" rel="noopener" className="text-brand-600 hover:underline">PDF</a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
