import Link from "next/link";
import {
  IndianRupee,
  ShoppingBag,
  ReceiptText,
  Boxes,
  Users,
  UserPlus,
  Repeat,
  Percent,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card } from "@/components/ui";

const DAY = 24 * 60 * 60 * 1000;

export const RANGES: { key: string; label: string; days: number }[] = [
  { key: "1d", label: "1 day", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "60d", label: "60 days", days: 60 },
  { key: "180d", label: "180 days", days: 180 },
  { key: "365d", label: "1 year", days: 365 },
];

// Resolve a range key from a query param, defaulting to 7 days.
export function resolveRange(key?: string) {
  return RANGES.find((r) => r.key === key) ?? RANGES[1];
}

function delta(cur: number, prev: number): { pct: number; up: boolean } | null {
  if (prev <= 0) return cur > 0 ? { pct: 100, up: true } : null;
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { pct: Math.abs(pct), up: pct >= 0 };
}

// Full per-restaurant analytics. Scoped purely by restaurantId + currency, so it
// renders identically whether driven by the restaurant's own admin (/admin/analytics)
// or by a super-admin picking any restaurant (/superadmin/analytics). `rangeHref`
// builds the href for each range toggle so the caller controls the surrounding URL.
export async function AnalyticsView({
  restaurantId,
  currency,
  rangeKey,
  rangeHref,
}: {
  restaurantId: string;
  currency: string;
  rangeKey: string;
  rangeHref: (key: string) => string;
}) {
  const range = resolveRange(rangeKey);
  const ms = range.days * DAY;

  const now = Date.now();
  const start = new Date(now - ms);
  const prevStart = new Date(now - 2 * ms);

  // Pull this period + the previous equal period for comparison.
  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { not: "CANCELLED" },
      createdAt: { gte: prevStart },
    },
    include: { items: true },
  });
  const cur = orders.filter((o) => o.createdAt >= start);
  const prev = orders.filter((o) => o.createdAt < start);

  const paid = cur.filter((o) => o.paymentStatus === "PAID");
  const paidPrev = prev.filter((o) => o.paymentStatus === "PAID");
  const revenue = paid.reduce((s, o) => s + toNumber(o.totalAmount), 0);
  const revenuePrev = paidPrev.reduce((s, o) => s + toNumber(o.totalAmount), 0);
  const gst = paid.reduce((s, o) => s + toNumber(o.taxAmount), 0);
  const avg = paid.length ? revenue / paid.length : 0;
  const itemsSold = cur.reduce((s, o) => s + o.items.reduce((a, i) => a + i.quantity, 0), 0);

  const phones = (list: typeof cur) =>
    new Set(list.map((o) => o.customerPhone).filter(Boolean) as string[]);
  const uniqueCustomers = phones(cur).size;
  const prevPhones = phones(prev);
  const newCustomers = [...phones(cur)].filter((p) => !prevPhones.has(p)).length;
  const returning = uniqueCustomers - newCustomers;

  const stats = [
    { label: "Orders", value: String(cur.length), icon: ShoppingBag, d: delta(cur.length, prev.length) },
    { label: "Revenue", value: formatMoney(revenue, currency), icon: IndianRupee, d: delta(revenue, revenuePrev) },
    { label: "Avg order", value: formatMoney(avg, currency), icon: ReceiptText, d: null },
    { label: "Items sold", value: String(itemsSold), icon: Boxes, d: null },
    { label: "Unique guests", value: String(uniqueCustomers), icon: Users, d: null },
    { label: "New guests", value: String(newCustomers), icon: UserPlus, d: null },
    { label: "Returning", value: String(returning), icon: Repeat, d: null },
    { label: "GST collected", value: formatMoney(gst, currency), icon: Percent, d: null },
  ];

  // Revenue trend, bucketed to keep ~7–31 bars regardless of range.
  const bucketDays = range.days <= 31 ? 1 : range.days <= 180 ? 7 : 30;
  const bucketMs = bucketDays * DAY;
  const buckets: { label: string; value: number }[] = [];
  for (let t = start.getTime(); t < now; t += bucketMs) {
    const end = t + bucketMs;
    const value = paid
      .filter((o) => o.createdAt.getTime() >= t && o.createdAt.getTime() < end)
      .reduce((s, o) => s + toNumber(o.totalAmount), 0);
    const d = new Date(t);
    buckets.push({
      label:
        bucketDays === 1
          ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
          : bucketDays === 7
            ? d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
            : d.toLocaleDateString("en-IN", { month: "short" }),
      value,
    });
  }
  const maxBucket = Math.max(1, ...buckets.map((b) => b.value));

  const hours = new Array(24).fill(0) as number[];
  for (const o of cur) hours[o.createdAt.getHours()]++;
  const maxHour = Math.max(1, ...hours);

  const itemMap = new Map<string, { qty: number; revenue: number }>();
  for (const o of cur)
    for (const it of o.items) {
      const e = itemMap.get(it.nameSnapshot) ?? { qty: 0, revenue: 0 };
      e.qty += it.quantity;
      e.revenue += toNumber(it.lineTotal);
      itemMap.set(it.nameSnapshot, e);
    }
  const topItems = [...itemMap.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 8);

  // Per-staff performance over the period — from staff-placed (POS) orders,
  // attributed via the order's createdByName snapshot.
  const staffMap = new Map<string, { orders: number; items: number; revenue: number }>();
  for (const o of cur) {
    if (o.channel !== "STAFF" || !o.createdByName) continue;
    const e = staffMap.get(o.createdByName) ?? { orders: 0, items: 0, revenue: 0 };
    e.orders += 1;
    e.items += o.items.reduce((a, i) => a + i.quantity, 0);
    e.revenue += toNumber(o.totalAmount);
    staffMap.set(o.createdByName, e);
  }
  const staffPerf = [...staffMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);

  const hourRange = (h: number) => {
    const f = (x: number) => {
      const hr = x % 24;
      return `${hr % 12 === 0 ? 12 : hr % 12} ${hr < 12 ? "AM" : "PM"}`;
    };
    return `${f(h)}–${f(h + 1)}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-sand-200 bg-surface p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={rangeHref(r.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                r.key === range.key ? "bg-ink text-white" : "text-ink/60 hover:bg-sand-100"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="-mt-3 text-sm text-ink/45">
        Last {range.label} · compared to the previous {range.label}
      </p>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-sand-200 bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <s.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              {s.d && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-medium ${
                    s.d.up ? "bg-olive-500/15 text-olive-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {s.d.up ? "▲" : "▼"} {s.d.pct}%
                </span>
              )}
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ink/45">
              {s.label}
            </p>
            <p className="mt-0.5 text-lg font-semibold text-ink sm:text-xl">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">Revenue trend</h2>
            <span className="text-xs text-ink/45">peak {formatMoney(maxBucket, currency)}</span>
          </div>
          <div className="no-scrollbar flex h-44 items-end gap-1 overflow-x-auto">
            {buckets.map((b, i) => (
              <div key={i} className="group relative flex min-w-[14px] flex-1 flex-col items-center gap-1">
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  <span className="block font-semibold">{b.label}</span>
                  <span className="block text-white/80">{formatMoney(b.value, currency)}</span>
                </div>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all group-hover:from-brand-700"
                    style={{ height: `${Math.max(2, (b.value / maxBucket) * 100)}%` }}
                  />
                </div>
                <span className="max-w-full truncate text-[9px] text-ink/40">{b.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="mb-5 font-display text-lg text-ink">Peak hours</h2>
          <div className="flex h-44 items-end gap-px">
            {hours.map((c, h) => (
              <div key={h} className="group relative flex h-full flex-1 items-end">
                <div className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-center text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  <span className="block font-semibold">{hourRange(h)}</span>
                  <span className="block text-white/80">{c} order{c === 1 ? "" : "s"}</span>
                </div>
                <div
                  className="w-full rounded-t-sm bg-brand-300 transition-all group-hover:bg-brand-500"
                  style={{ height: `${Math.max(2, (c / maxHour) * 100)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink/40">
            <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-5 font-display text-lg text-ink">Top selling items</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-ink/45">No sales in this period yet.</p>
        ) : (
          <ul className="space-y-3">
            {topItems.map(([name, e], i) => (
              <li key={name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{name}</span>
                  <span className="text-xs text-ink/45">{e.qty} sold</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink">
                  {formatMoney(e.revenue, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-1 flex items-center gap-2">
          <Users className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
          <h2 className="font-display text-lg text-ink">Staff performance</h2>
        </div>
        <p className="mb-4 text-sm text-ink/45">
          Orders taken at the POS by each team member, this period.
        </p>
        {staffPerf.length === 0 ? (
          <p className="text-sm text-ink/45">
            No staff-placed orders in this period.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink/40">
                <th className="pb-2 font-medium">Member</th>
                <th className="pb-2 text-right font-medium">Orders</th>
                <th className="pb-2 text-right font-medium">Items</th>
                <th className="pb-2 text-right font-medium">Sales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-100">
              {staffPerf.map(([name, e]) => (
                <tr key={name}>
                  <td className="py-2 text-ink">{name}</td>
                  <td className="py-2 text-right text-ink/80">{e.orders}</td>
                  <td className="py-2 text-right text-ink/80">{e.items}</td>
                  <td className="py-2 text-right font-medium text-ink">
                    {formatMoney(e.revenue, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
