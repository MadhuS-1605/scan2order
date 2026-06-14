import {
  Building2,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Layers,
  Trophy,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, superSetPlanAction } from "@/lib/platform/actions";
import { PLANS } from "@/lib/plans";
import { formatMoney, toNumber } from "@/lib/utils";

const DAY = 24 * 60 * 60 * 1000;

export default async function SuperAdminPage() {
  await requireSuperAdmin();

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const start30 = new Date(Date.now() - 30 * DAY);

  const [restaurants, planGroups, todayAgg, m30Agg, ordersTotal] = await Promise.all([
    prisma.restaurant.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: { where: { paymentStatus: "PAID" }, select: { totalAmount: true } },
      },
    }),
    prisma.restaurant.groupBy({ by: ["planTier"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: startToday } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { paymentStatus: "PAID", createdAt: { gte: start30 } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.order.count(),
  ]);

  const rows = restaurants.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    plan: r.planTier,
    orders: r._count.orders,
    revenue: r.orders.reduce((s, o) => s + toNumber(o.totalAmount), 0),
    createdAt: r.createdAt,
  }));
  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const top = [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const planCount = new Map(planGroups.map((g) => [g.planTier, g._count._all]));

  const stat = (label: string, value: string, sub: string, Icon: typeof Building2) => (
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
    <div className="min-h-screen bg-grain">
      <header className="border-b border-sand-200 bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <p className="font-display text-lg text-ink">
            Scan to Order <span className="text-ink/40">· Platform console</span>
          </p>
          <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
            Super admin
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {/* Platform stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {stat("Restaurants", String(rows.length), `${ordersTotal} orders all-time`, Building2)}
          {stat("Platform GMV", formatMoney(totalRevenue), "paid, all-time", IndianRupee)}
          {stat(
            "Today",
            formatMoney(toNumber(todayAgg._sum.totalAmount ?? 0)),
            `${todayAgg._count._all} orders`,
            ShoppingBag,
          )}
          {stat(
            "Last 30 days",
            formatMoney(toNumber(m30Agg._sum.totalAmount ?? 0)),
            `${m30Agg._count._all} orders`,
            TrendingUp,
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Plan distribution */}
          <div className="rounded-2xl border border-sand-200 bg-surface p-5">
            <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
              <Layers className="h-4 w-4 text-brand-600" /> Plans
            </h2>
            <ul className="space-y-2">
              {PLANS.map((p) => {
                const n = planCount.get(p.tier) ?? 0;
                const pct = rows.length ? Math.round((n / rows.length) * 100) : 0;
                return (
                  <li key={p.tier}>
                    <div className="flex justify-between text-sm">
                      <span className="text-ink/70">{p.name}</span>
                      <span className="font-medium text-ink">{n}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sand-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Top performers */}
          <div className="rounded-2xl border border-sand-200 bg-surface p-5 lg:col-span-2">
            <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
              <Trophy className="h-4 w-4 text-amber-500" /> Top restaurants by revenue
            </h2>
            {top.length === 0 ? (
              <p className="text-sm text-ink/45">No paid orders yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {top.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                      <span className="text-xs text-ink/45">{r.orders} orders · {r.plan}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {formatMoney(r.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* All restaurants */}
        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-2.5">Restaurant</th>
                <th className="px-4 py-2.5">Orders</th>
                <th className="px-4 py-2.5">Revenue</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-ink">{r.name}</span>
                    <span className="block text-xs text-ink/40">/{r.slug}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink/70">{r.orders}</td>
                  <td className="px-4 py-2.5 text-ink/70">{formatMoney(r.revenue)}</td>
                  <td className="px-4 py-2.5 text-ink/55">
                    {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5">
                    <form action={superSetPlanAction} className="flex items-center gap-1">
                      <input type="hidden" name="restaurantId" value={r.id} />
                      <select
                        name="tier"
                        defaultValue={r.plan}
                        className="rounded-md border border-sand-300 bg-surface px-2 py-1 text-xs"
                      >
                        {PLANS.map((p) => (
                          <option key={p.tier} value={p.tier}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        Set
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
