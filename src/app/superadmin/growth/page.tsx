import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { subscriptionState } from "@/lib/subscription";
import { STEPS } from "@/lib/onboarding/steps";
import { formatMoney, toNumber } from "@/lib/utils";
import { StatCard } from "@/components/superadmin/stat-card";

export default async function PlatformGrowthPage() {
  await requireSuperAdmin();

  const now = new Date();
  const firstMonthStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [createdRows, configTotal, configDone, stepGroups, typeGroups, stateGroups, subRows, planPays] =
    await Promise.all([
      prisma.restaurant.findMany({ select: { createdAt: true } }),
      prisma.onboardingConfig.count(),
      prisma.onboardingConfig.count({ where: { onboardingCompleted: true } }),
      prisma.onboardingConfig.groupBy({ by: ["onboardingStep"], where: { onboardingCompleted: false }, _count: { _all: true } }),
      prisma.restaurant.groupBy({ by: ["type"], _count: { _all: true } }),
      prisma.restaurant.groupBy({ by: ["state"], _count: { _all: true } }),
      prisma.restaurant.findMany({ select: { planTier: true, planActiveUntil: true, planIsTrial: true } }),
      prisma.planPayment.findMany({ where: { status: "PAID", createdAt: { gte: firstMonthStart } }, select: { amount: true, createdAt: true } }),
    ]);

  // Signups + plan revenue over the last 6 calendar months.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleString("en-IN", { month: "short" }), count: 0, revenue: 0 };
  });
  const monthByKey = new Map(months.map((m) => [m.key, m]));
  const keyOf = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
  for (const r of createdRows) {
    const m = monthByKey.get(keyOf(r.createdAt));
    if (m) m.count += 1;
  }
  for (const p of planPays) {
    const m = monthByKey.get(keyOf(p.createdAt));
    if (m) m.revenue += toNumber(p.amount);
  }
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const maxRev = Math.max(1, ...months.map((m) => m.revenue));

  // Subscription mix → churn.
  let active = 0, trial = 0, lapsed = 0;
  for (const r of subRows) {
    const s = subscriptionState(r).status;
    if (s === "ACTIVE") active += 1;
    else if (s === "TRIAL") trial += 1;
    else if (s === "EXPIRED") lapsed += 1;
  }
  const paidBase = active + lapsed;
  const churnPct = paidBase ? Math.round((lapsed / paidBase) * 100) : 0;
  const convPct = configTotal ? Math.round((configDone / configTotal) * 100) : 0;

  const stepCount = new Map(stepGroups.map((g) => [g.onboardingStep, g._count._all]));
  const inProgress = STEPS.filter((s) => s !== "done");

  const card = "rounded-2xl border border-sand-200 bg-surface p-5";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Growth & funnel</h1>
        <p className="text-sm text-ink/45">Signups, onboarding conversion, churn, and distribution.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total venues" value={String(configTotal)} sub="with config" />
        <StatCard label="Onboarding done" value={`${convPct}%`} sub={`${configDone} of ${configTotal}`} />
        <StatCard label="Active + trial" value={String(active + trial)} sub={`${active} paid · ${trial} trial`} />
        <StatCard label="Churn" value={`${churnPct}%`} sub={`${lapsed} lapsed of ${paidBase}`} alert={churnPct >= 20} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Signups */}
        <div className={card}>
          <h2 className="mb-4 font-medium text-ink">Signups (last 6 months)</h2>
          <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-medium text-ink/60">{m.count}</span>
                <div className="w-full rounded-t bg-brand-500" style={{ height: `${Math.round((m.count / maxMonth) * 110)}px` }} />
                <span className="text-xs text-ink/45">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan revenue */}
        <div className={card}>
          <h2 className="mb-4 font-medium text-ink">Plan revenue (last 6 months)</h2>
          <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
            {months.map((m) => (
              <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[10px] font-medium text-ink/55">{m.revenue ? formatMoney(m.revenue) : "—"}</span>
                <div className="w-full rounded-t bg-olive-500" style={{ height: `${Math.round((m.revenue / maxRev) * 110)}px` }} />
                <span className="text-xs text-ink/45">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Onboarding funnel */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Onboarding funnel</h2>
          <p className="mb-2 text-sm text-ink/55">{configDone} completed · {configTotal - configDone} in progress</p>
          <ul className="space-y-2 text-sm">
            {inProgress.map((step, i) => {
              const n = stepCount.get(i) ?? 0;
              const pct = configTotal ? Math.round((n / configTotal) * 100) : 0;
              return (
                <li key={step}>
                  <div className="flex justify-between">
                    <span className="capitalize text-ink/70">Stuck at {step}</span>
                    <span className="font-medium text-ink">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Venue type */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">By venue type</h2>
          <ul className="space-y-1.5 text-sm">
            {typeGroups.sort((a, b) => b._count._all - a._count._all).map((g) => (
              <li key={g.type} className="flex justify-between">
                <span className="capitalize text-ink/70">{g.type.toLowerCase().replace(/_/g, " ")}</span>
                <span className="font-medium text-ink">{g._count._all}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Geography */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">By state</h2>
          <ul className="space-y-1.5 text-sm">
            {stateGroups
              .filter((g) => g.state)
              .sort((a, b) => b._count._all - a._count._all)
              .slice(0, 8)
              .map((g) => (
                <li key={g.state} className="flex justify-between">
                  <span className="text-ink/70">{g.state}</span>
                  <span className="font-medium text-ink">{g._count._all}</span>
                </li>
              ))}
            {stateGroups.every((g) => !g.state) && <li className="text-ink/45">No location data yet.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
