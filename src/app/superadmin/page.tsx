import {
  Building2,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Layers,
  Trophy,
  Search,
} from "lucide-react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, bulkTenantAction } from "@/lib/platform/actions";
import { PLANS, type PlanTier } from "@/lib/plans";
import { formatMoney, toNumber } from "@/lib/utils";

const PAGE_SIZE = 20;
const TIERS = new Set(PLANS.map((p) => p.tier));

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; plan?: string; status?: string; sort?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const planFilter = sp.plan && TIERS.has(sp.plan as PlanTier) ? (sp.plan as PlanTier) : undefined;
  const statusFilter = sp.status === "SUSPENDED" || sp.status === "ACTIVE" ? sp.status : undefined;
  const sort = sp.sort ?? "joined";
  const page = Math.max(1, Number(sp.page) || 1);

  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const where: Prisma.RestaurantWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { subdomain: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(planFilter ? { planTier: planFilter } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };
  const orderBy: Prisma.RestaurantOrderByWithRelationInput =
    sort === "name"
      ? { name: "asc" }
      : sort === "orders"
        ? { orders: { _count: "desc" } }
        : { createdAt: "desc" };

  const [totalCount, filteredCount, planGroups, todayAgg, gmvAgg, ordersTotal, topGroups, pageRows] =
    await Promise.all([
      prisma.restaurant.count(),
      prisma.restaurant.count({ where }),
      prisma.restaurant.groupBy({ by: ["planTier"], _count: { _all: true } }),
      prisma.order.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: startToday } }, _sum: { totalAmount: true }, _count: { _all: true } }),
      prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
      prisma.order.count(),
      prisma.order.groupBy({
        by: ["restaurantId"],
        where: { paymentStatus: "PAID" },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: "desc" } },
        take: 5,
      }),
      prisma.restaurant.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: { id: true, name: true, slug: true, planTier: true, status: true, createdAt: true, _count: { select: { orders: true } } },
      }),
    ]);

  // Per-page paid revenue (scoped to the visible rows — avoids loading all orders).
  const pageIds = pageRows.map((r) => r.id);
  const revAgg = pageIds.length
    ? await prisma.order.groupBy({
        by: ["restaurantId"],
        where: { restaurantId: { in: pageIds }, paymentStatus: "PAID" },
        _sum: { totalAmount: true },
      })
    : [];
  const revById = new Map(revAgg.map((g) => [g.restaurantId, toNumber(g._sum.totalAmount ?? 0)]));

  // Names for the top-revenue list.
  const topNames = new Map(
    (await prisma.restaurant.findMany({ where: { id: { in: topGroups.map((g) => g.restaurantId) } }, select: { id: true, name: true, planTier: true } }))
      .map((r) => [r.id, r]),
  );
  const top = topGroups.map((g) => ({
    id: g.restaurantId,
    name: topNames.get(g.restaurantId)?.name ?? "—",
    plan: topNames.get(g.restaurantId)?.planTier ?? "FREE",
    revenue: toNumber(g._sum.totalAmount ?? 0),
  }));

  const planCount = new Map(planGroups.map((g) => [g.planTier, g._count._all]));
  const totalGmv = toNumber(gmvAgg._sum.totalAmount ?? 0);
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const qs = (over: Record<string, string | number | undefined>) => {
    const merged = { q, plan: planFilter, status: statusFilter, sort, page, ...over };
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && v !== "joined") u.set(k, String(v));
    const s = u.toString();
    return s ? `/superadmin?${s}` : "/superadmin";
  };

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
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-medium text-ink">Console</h1>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stat("Restaurants", String(totalCount), `${ordersTotal} orders all-time`, Building2)}
        {stat("Platform GMV", formatMoney(totalGmv), "diner sales, all-time", IndianRupee)}
        {stat("Today", formatMoney(toNumber(todayAgg._sum.totalAmount ?? 0)), `${todayAgg._count._all} orders`, ShoppingBag)}
        {stat("Avg / restaurant", formatMoney(totalCount ? totalGmv / totalCount : 0), "lifetime GMV", TrendingUp)}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
            <Layers className="h-4 w-4 text-brand-600" /> Plans
          </h2>
          <ul className="space-y-2">
            {PLANS.map((p) => {
              const n = planCount.get(p.tier) ?? 0;
              const pct = totalCount ? Math.round((n / totalCount) * 100) : 0;
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
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                  <Link href={`/superadmin/restaurants/${r.id}`} className="min-w-0 flex-1 truncate text-sm font-medium text-ink hover:text-brand-600 hover:underline">
                    {r.name} <span className="text-xs text-ink/45">· {r.plan}</span>
                  </Link>
                  <span className="shrink-0 text-sm font-semibold text-ink">{formatMoney(r.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-2xl border border-sand-200 bg-surface p-3">
        <label className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input name="q" defaultValue={q} placeholder="Search name or subdomain…" className="w-full rounded-md border border-sand-300 bg-surface py-1.5 pl-8 pr-2 text-sm" />
        </label>
        <select name="plan" defaultValue={planFilter ?? ""} className="rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm">
          <option value="">All plans</option>
          {PLANS.map((p) => <option key={p.tier} value={p.tier}>{p.name}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter ?? ""} className="rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <select name="sort" defaultValue={sort} className="rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm">
          <option value="joined">Newest</option>
          <option value="name">Name</option>
          <option value="orders">Most orders</option>
        </select>
        <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        {(q || planFilter || statusFilter || sort !== "joined") && (
          <Link href="/superadmin" className="rounded-md border border-sand-300 px-3 py-1.5 text-sm text-ink/60 hover:bg-sand-100">Clear</Link>
        )}
      </form>

      {/* Tenants — select rows + apply a bulk action (native form, no JS) */}
      <form action={bulkTenantAction} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sand-200 bg-surface p-3 text-sm">
          <span className="text-ink/55">With selected:</span>
          <select name="op" defaultValue="" className="rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm">
            <option value="" disabled>Choose action…</option>
            <option value="suspend">Suspend</option>
            <option value="reactivate">Reactivate</option>
            <option value="plan:FREE">Set plan → Free</option>
            <option value="plan:STARTER">Set plan → Starter</option>
            <option value="plan:PRO">Set plan → Pro</option>
            <option value="plan:ENTERPRISE">Set plan → Enterprise</option>
          </select>
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Apply</button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
              <tr>
                <th className="px-4 py-2.5"></th>
                <th className="px-4 py-2.5">Restaurant</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Orders</th>
                <th className="px-4 py-2.5">Revenue</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {pageRows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-ink/45">No restaurants match.</td></tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.name}`} />
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/superadmin/restaurants/${r.id}`} className="font-medium text-ink hover:text-brand-600 hover:underline">{r.name}</Link>
                      <span className="block text-xs text-ink/40">/{r.slug}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {r.status === "SUSPENDED" ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Suspended</span>
                      ) : (
                        <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">{r._count.orders}</td>
                    <td className="px-4 py-2.5 text-ink/70">{formatMoney(revById.get(r.id) ?? 0)}</td>
                    <td className="px-4 py-2.5 text-ink/55">{r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2.5 text-ink/70">{r.planTier}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </form>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-ink/55">
        <span>{filteredCount} restaurant{filteredCount === 1 ? "" : "s"} · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs({ page: page - 1 })} className="rounded-md border border-sand-300 px-3 py-1.5 hover:bg-sand-100">Previous</Link>}
          {page < totalPages && <Link href={qs({ page: page + 1 })} className="rounded-md border border-sand-300 px-3 py-1.5 hover:bg-sand-100">Next</Link>}
        </div>
      </div>
    </div>
  );
}
