import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { dayReport, todayInTz } from "@/lib/reports/daily";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant, config } = await getCurrentRestaurant("analytics");
  const tz = config.timezone || "Asia/Kolkata";
  const cur = config.currency || "INR";
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : todayInTz(tz);
  const rep = await dayReport(restaurant.id, date, tz, cur);

  const card = "rounded-2xl border border-sand-200 bg-surface p-5";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">{t(d, "reports.title")}</h1>
          <p className="text-sm text-ink/45">{t(d, "reports.subtitle")}</p>
        </div>
        <form method="get" className="flex items-end gap-2">
          <input type="date" name="date" defaultValue={date} max={todayInTz(tz)} className="rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm" />
          <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">{t(d, "reports.view")}</button>
          <a href={`/api/export/orders`} target="_blank" rel="noopener" className="rounded-md border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100">{t(d, "reports.exportOrders")}</a>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric label={t(d, "reports.grossSales")} value={formatMoney(rep.gross, cur)} />
        <Metric label={t(d, "reports.netSales")} value={formatMoney(rep.net, cur)} />
        <Metric label={t(d, "reports.paidOrders")} value={`${rep.paidOrders} / ${rep.ordersPlaced}`} />
        <Metric label={t(d, "reports.gstCollected")} value={formatMoney(rep.tax, cur)} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Metric label={t(d, "reports.tips")} value={formatMoney(rep.tips, cur)} />
        <Metric label={t(d, "reports.discounts")} value={formatMoney(rep.discounts, cur)} />
        <Metric label={t(d, "reports.refunds")} value={formatMoney(rep.refunds, cur)} />
        <Metric label={t(d, "reports.avgOrder")} value={formatMoney(rep.paidOrders ? rep.gross / rep.paidOrders : 0, cur)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">{t(d, "reports.byPayment")}</h2>
          {rep.byPayment.length === 0 ? (
            <p className="text-sm text-ink/45">{t(d, "reports.noSales")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {rep.byPayment.map((p) => (
                <li key={p.method} className="flex justify-between">
                  <span className="text-ink/70">{p.method} <span className="text-ink/40">· {p.count}</span></span>
                  <span className="font-medium text-ink">{formatMoney(p.amount, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">{t(d, "reports.topItems")}</h2>
          {rep.topItems.length === 0 ? (
            <p className="text-sm text-ink/45">{t(d, "reports.noSales")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {rep.topItems.map((it) => (
                <li key={it.name} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate text-ink/70">{it.qty}× {it.name}</span>
                  <span className="shrink-0 font-medium text-ink">{formatMoney(it.amount, cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}
