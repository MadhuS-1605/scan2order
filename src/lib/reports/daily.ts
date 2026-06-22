import "server-only";
import { prisma } from "@/lib/db";
import { toNumber, formatMoney, escapeHtml } from "@/lib/utils";
import { sendEmail } from "@/lib/messaging/provider";
import { reportError } from "@/lib/observability";

// End-of-day ("Z report") sales rollup for a single venue-local day. Day
// boundaries are computed in the venue timezone so "today" matches the owner's
// clock, not the server's.

// UTC instant of local midnight for a YYYY-MM-DD in an IANA timezone.
function zonedDayStart(dateStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcGuess));
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUtc = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return new Date(utcGuess - (asUtc - utcGuess)); // local midnight as a UTC instant
}

// Today's date string (YYYY-MM-DD) in a timezone.
export function todayInTz(tz: string, now: Date = new Date()): string {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now)) {
    p[part.type] = part.value;
  }
  return `${p.year}-${p.month}-${p.day}`;
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export type DayReport = {
  date: string;
  currency: string;
  ordersPlaced: number;
  paidOrders: number;
  gross: number;
  tax: number;
  tips: number;
  discounts: number;
  refunds: number;
  net: number; // gross - refunds
  byPayment: { method: string; count: number; amount: number }[];
  byChannel: { channel: string; count: number }[];
  topItems: { name: string; qty: number; amount: number }[];
};

export async function dayReport(
  restaurantId: string,
  dateStr: string,
  tz: string,
  currency: string,
): Promise<DayReport> {
  const start = zonedDayStart(dateStr, tz);
  const end = zonedDayStart(addDays(dateStr, 1), tz);
  const window = { gte: start, lt: end };

  const [ordersPlaced, paid, refundAgg] = await Promise.all([
    prisma.order.count({ where: { restaurantId, createdAt: window } }),
    prisma.order.findMany({
      where: { restaurantId, paymentStatus: "PAID", createdAt: window },
      select: {
        totalAmount: true, taxAmount: true, tipAmount: true, discountAmount: true,
        paymentMethod: true, channel: true,
        items: { select: { nameSnapshot: true, quantity: true, lineTotal: true } },
      },
    }),
    prisma.refund.aggregate({ where: { restaurantId, createdAt: window }, _sum: { amount: true } }),
  ]);

  let gross = 0, tax = 0, tips = 0, discounts = 0;
  const payMap = new Map<string, { count: number; amount: number }>();
  const chanMap = new Map<string, number>();
  const itemMap = new Map<string, { qty: number; amount: number }>();
  for (const o of paid) {
    gross += toNumber(o.totalAmount);
    tax += toNumber(o.taxAmount);
    tips += toNumber(o.tipAmount);
    discounts += toNumber(o.discountAmount);
    const pm = o.paymentMethod ?? "OTHER";
    const p = payMap.get(pm) ?? { count: 0, amount: 0 };
    p.count += 1; p.amount += toNumber(o.totalAmount); payMap.set(pm, p);
    chanMap.set(o.channel, (chanMap.get(o.channel) ?? 0) + 1);
    for (const it of o.items) {
      const e = itemMap.get(it.nameSnapshot) ?? { qty: 0, amount: 0 };
      e.qty += it.quantity; e.amount += toNumber(it.lineTotal); itemMap.set(it.nameSnapshot, e);
    }
  }
  const refunds = toNumber(refundAgg._sum.amount ?? 0);
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  return {
    date: dateStr,
    currency,
    ordersPlaced,
    paidOrders: paid.length,
    gross: r2(gross),
    tax: r2(tax),
    tips: r2(tips),
    discounts: r2(discounts),
    refunds: r2(refunds),
    net: r2(gross - refunds),
    byPayment: [...payMap.entries()].map(([method, v]) => ({ method, count: v.count, amount: r2(v.amount) })).sort((a, b) => b.amount - a.amount),
    byChannel: [...chanMap.entries()].map(([channel, count]) => ({ channel, count })).sort((a, b) => b.count - a.count),
    topItems: [...itemMap.entries()].map(([name, v]) => ({ name, qty: v.qty, amount: r2(v.amount) })).sort((a, b) => b.qty - a.qty).slice(0, 10),
  };
}

function summaryHtml(name: string, rep: DayReport): string {
  const row = (l: string, v: string) =>
    `<tr><td style="padding:4px 0;color:#666">${l}</td><td style="padding:4px 0;text-align:right;font-weight:600">${v}</td></tr>`;
  const m = (n: number) => formatMoney(n, rep.currency);
  const items = rep.topItems.slice(0, 5).map((it) => `<li>${it.qty}× ${escapeHtml(it.name)} — ${m(it.amount)}</li>`).join("");
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
    <h2 style="margin:0 0 4px">${escapeHtml(name)} — daily sales</h2>
    <p style="margin:0 0 16px;color:#666">${rep.date}</p>
    <table style="width:100%;max-width:360px;border-collapse:collapse;font-size:14px">
      ${row("Gross sales", m(rep.gross))}
      ${row("Net (after refunds)", m(rep.net))}
      ${row("Paid / placed orders", `${rep.paidOrders} / ${rep.ordersPlaced}`)}
      ${row("GST collected", m(rep.tax))}
      ${row("Tips", m(rep.tips))}
      ${row("Discounts", m(rep.discounts))}
      ${row("Refunds", m(rep.refunds))}
    </table>
    ${items ? `<p style="margin:16px 0 4px;font-weight:600">Top items</p><ul style="margin:0;padding-left:18px;color:#333;font-size:14px">${items}</ul>` : ""}
    <p style="color:#999;font-size:12px;margin:20px 0 0">Powered by Scan to Order</p>
  </div>`;
}

// Email an end-of-day summary (yesterday) to opted-in venues with an owner email.
export async function runDailySummaries(now: Date = new Date()): Promise<{ sent: number }> {
  const venues = await prisma.restaurant.findMany({
    where: { email: { not: null }, config: { dailyReportEmail: true } },
    select: { id: true, name: true, email: true, config: { select: { timezone: true, currency: true } } },
  });
  let sent = 0;
  for (const v of venues) {
    try {
      const tz = v.config?.timezone || "Asia/Kolkata";
      const cur = v.config?.currency || "INR";
      const date = addDays(todayInTz(tz, now), -1); // yesterday, venue-local
      const rep = await dayReport(v.id, date, tz, cur);
      await sendEmail(v.email!, `Daily sales — ${v.name} — ${date}`, summaryHtml(v.name, rep));
      sent++;
    } catch (e) {
      reportError("reports.dailySummary", e, { restaurantId: v.id });
    }
  }
  return { sent };
}
