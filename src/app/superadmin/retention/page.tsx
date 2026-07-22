import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, sendWinbackAction } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { subscriptionState } from "@/lib/subscription";

type Risk = { id: string; name: string; reason: string; severity: number; lastOrder: Date | null; lapsed: boolean };

export default async function RetentionPage() {
  const s = await requireSuperAdmin();
  const canWinback = platformCan(s.platformRole, "tenants.manage");
  const quietCutoff = new Date();
  quietCutoff.setDate(quietCutoff.getDate() - 14);

  const last7Start = new Date(Date.now() - 7 * 86_400_000);
  const prior7Start = new Date(Date.now() - 14 * 86_400_000);

  const [restaurants, lastOrders, ordersLast7, ordersPrior7] = await Promise.all([
    prisma.restaurant.findMany({
      select: { id: true, name: true, planTier: true, planActiveUntil: true, planIsTrial: true },
    }),
    prisma.order.groupBy({ by: ["restaurantId"], _max: { createdAt: true } }),
    prisma.order.groupBy({ by: ["restaurantId"], where: { createdAt: { gte: last7Start } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["restaurantId"], where: { createdAt: { gte: prior7Start, lt: last7Start } }, _count: { _all: true } }),
  ]);
  const lastById = new Map(lastOrders.map((o) => [o.restaurantId, o._max.createdAt]));
  const last7ById = new Map(ordersLast7.map((o) => [o.restaurantId, o._count._all]));
  const prior7ById = new Map(ordersPrior7.map((o) => [o.restaurantId, o._count._all]));

  const risks: Risk[] = [];
  for (const r of restaurants) {
    const sub = subscriptionState(r);
    const last = lastById.get(r.id) ?? null;
    const quiet = !last || last < quietCutoff;
    if (sub.status === "EXPIRED") {
      risks.push({ id: r.id, name: r.name, reason: "Plan lapsed", severity: 3, lastOrder: last, lapsed: true });
    } else if (sub.status === "TRIAL" && (sub.daysLeft ?? 99) <= 3) {
      risks.push({ id: r.id, name: r.name, reason: `Trial ends in ${sub.daysLeft}d`, severity: 2, lastOrder: last, lapsed: false });
    } else if ((sub.status === "ACTIVE" || sub.status === "TRIAL") && quiet) {
      risks.push({ id: r.id, name: r.name, reason: last ? "No orders in 14+ days" : "No orders yet", severity: 1, lastOrder: last, lapsed: false });
    } else if (sub.status === "ACTIVE" || sub.status === "TRIAL") {
      // Still ordering, but meaningfully down vs their own recent baseline —
      // catches a venue quietly winding down before it goes fully silent
      // (the "no orders in 14+ days" check above only fires after that point).
      const prior = prior7ById.get(r.id) ?? 0;
      const last7 = last7ById.get(r.id) ?? 0;
      if (prior >= 5 && last7 <= prior * 0.5) {
        const pct = Math.round((1 - last7 / prior) * 100);
        risks.push({ id: r.id, name: r.name, reason: `Orders down ${pct}% this week`, severity: 1, lastOrder: last, lapsed: false });
      }
    }
  }
  risks.sort((a, b) => b.severity - a.severity || (b.lastOrder?.getTime() ?? 0) - (a.lastOrder?.getTime() ?? 0));

  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const badge = (sev: number) =>
    sev === 3 ? "bg-red-100 text-red-700" : sev === 2 ? "bg-amber-100 text-amber-700" : "bg-sand-100 text-ink/60";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Retention</h1>
        <p className="text-sm text-ink/45">Venues that need attention — lapsed, trial-ending, or gone quiet.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Restaurant</th>
              <th className="px-4 py-2.5">Risk</th>
              <th className="px-4 py-2.5">Last order</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {risks.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-ink/45">All venues healthy 🎉</td></tr>
            ) : (
              risks.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <Link href={`/superadmin/restaurants/${r.id}`} className="font-medium text-ink hover:text-brand-600 hover:underline">{r.name}</Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge(r.severity)}`}>{r.reason}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink/55">{fmt(r.lastOrder)}</td>
                  <td className="px-4 py-2.5">
                    {r.lapsed && canWinback && (
                      <form action={sendWinbackAction}>
                        <input type="hidden" name="restaurantId" value={r.id} />
                        <button type="submit" className="rounded-md border border-sand-300 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-sand-100">Send win-back</button>
                      </form>
                    )}
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
