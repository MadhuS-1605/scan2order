import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { hasCapability } from "@/lib/capabilities";
import { minTierFor, planByTier } from "@/lib/plans";
import { segmentCounts } from "@/lib/campaigns/actions";
import { CampaignComposer } from "./campaign-composer";

export default async function CustomersPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("analytics");
  const rid = restaurant.id;

  const [customers, counts, whatsappOk, recent] = await Promise.all([
    prisma.customer.findMany({
      where: { orders: { some: { restaurantId: rid } } },
      select: {
        id: true,
        phone: true,
        name: true,
        loyaltyPoints: true,
        _count: { select: { orders: { where: { restaurantId: rid } } } },
      },
      take: 200,
    }),
    segmentCounts(rid),
    hasCapability(rid, "whatsapp"),
    prisma.campaign.findMany({ where: { restaurantId: rid }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const sorted = [...customers].sort((a, b) => b._count.orders - a._count.orders);

  const stats = [
    { label: t(d, "customers.allGuests"), value: counts.all },
    { label: t(d, "customers.repeat"), value: counts.repeat },
    { label: t(d, "customers.recent"), value: counts.recent },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "customers.title")}</h1>
        <p className="text-sm text-ink/45">{t(d, "customers.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">{t(d, "customers.sendCampaign")}</h2>
          {whatsappOk ? (
            <CampaignComposer counts={counts} />
          ) : (
            <p className="text-sm text-ink/60">
              {t(d, "customers.upgradeNeeded")} ({planByTier(minTierFor("whatsapp")).name}){" "}
              <Link href="/admin/billing" className="text-brand-600 hover:underline">{t(d, "customers.upgrade")} →</Link>
            </p>
          )}
          {recent.length > 0 && (
            <div className="mt-4 border-t border-sand-100 pt-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">{t(d, "customers.recentCampaigns")}</p>
              <ul className="space-y-1.5 text-sm">
                {recent.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink/70">{c.message}</span>
                    <span className="shrink-0 text-ink/45">{c.sentCount}/{c.recipientCount}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 self-start">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-sand-200 bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ink">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">{t(d, "customers.colGuest")}</th>
              <th className="px-4 py-2.5">{t(d, "customers.colVisits")}</th>
              <th className="px-4 py-2.5">{t(d, "customers.colLoyalty")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {sorted.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-ink/45">{t(d, "customers.none")}</td></tr>
            ) : (
              sorted.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-ink">{c.name ?? t(d, "customers.guest")}</span>
                    <span className="block text-xs text-ink/40">{c.phone}</span>
                  </td>
                  <td className="px-4 py-2.5 text-ink/70">{c._count.orders}</td>
                  <td className="px-4 py-2.5 text-ink/70">{c.loyaltyPoints} pts</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-ink/40">{t(d, "customers.showingNote")}</p>
      </div>
    </div>
  );
}
