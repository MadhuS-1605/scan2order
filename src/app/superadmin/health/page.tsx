import Link from "next/link";
import { AlertTriangle, RotateCcw, Clock, CreditCard } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { formatMoney, toNumber } from "@/lib/utils";
import { StatCard } from "@/components/superadmin/stat-card";

export default async function PlatformHealthPage() {
  await requireSuperAdmin();

  const start30 = new Date();
  start30.setDate(start30.getDate() - 30);
  // Online-payment intents stuck PENDING beyond this are awaiting the sweep.
  const staleCutoff = new Date();
  staleCutoff.setMinutes(staleCutoff.getMinutes() - 30);

  const [planFailed, payFailed30, refundAll, refund30, refundTop, stalePending] = await Promise.all([
    prisma.planPayment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: start30 } } }),
    prisma.refund.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.refund.aggregate({ where: { createdAt: { gte: start30 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.refund.groupBy({ by: ["restaurantId"], _count: { _all: true }, _sum: { amount: true }, orderBy: { _count: { restaurantId: "desc" } }, take: 5 }),
    prisma.order.count({ where: { paymentStatus: "PENDING", status: { not: "CANCELLED" }, updatedAt: { lt: staleCutoff } } }),
  ]);

  const refundNames = new Map(
    (await prisma.restaurant.findMany({ where: { id: { in: refundTop.map((r) => r.restaurantId) } }, select: { id: true, name: true } }))
      .map((r) => [r.id, r.name]),
  );

  // Platform service configuration (booleans only — no secrets rendered).
  const provider = env.messaging.provider;
  const whatsappReady =
    provider === "meta"
      ? Boolean(env.messaging.meta.token && env.messaging.meta.phoneNumberId)
      : false;
  const services: { label: string; ok: boolean; note?: string }[] = [
    { label: "Razorpay (platform)", ok: env.razorpay.configured() },
    { label: "Razorpay webhook", ok: Boolean(env.razorpay.webhookSecret) },
    { label: "Email (Resend)", ok: env.email.configured() },
    { label: `WhatsApp (${provider})`, ok: whatsappReady, note: provider === "console" ? "console only" : undefined },
    { label: "Cloudflare DNS", ok: env.cloudflare.configured() },
    { label: "Cron secret", ok: Boolean(env.cronSecret) },
    { label: "Sentry", ok: Boolean(env.sentryDsn) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Platform health</h1>
        <p className="text-sm text-ink/45">Payments, refunds, stuck orders, and service configuration.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Stuck payments" value={String(stalePending)} sub="PENDING >30 min (awaiting sweep)" icon={Clock} alert={stalePending > 0} />
        <StatCard label="Failed plan payments" value={String(planFailed)} sub="all-time" icon={CreditCard} alert={planFailed > 0} />
        <StatCard label="Failed diner payments" value={String(payFailed30)} sub="last 30 days" icon={CreditCard} alert={payFailed30 > 0} />
        <StatCard label="Refunds" value={formatMoney(toNumber(refund30._sum.amount ?? 0))} sub={`${refund30._count._all} in 30d · ${refundAll._count._all} all-time`} icon={RotateCcw} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Service config */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">Service configuration</h2>
          <ul className="space-y-2 text-sm">
            {services.map((s) => (
              <li key={s.label} className="flex items-center justify-between">
                <span className="text-ink/70">{s.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.ok ? "bg-olive-100 text-olive-700" : "bg-sand-100 text-ink/45"}`}>
                  {s.ok ? "Configured" : s.note ?? "Not set"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Refund leaders */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">Most refunds (by count)</h2>
          {refundTop.length === 0 ? (
            <p className="text-sm text-ink/45">No refunds recorded.</p>
          ) : (
            <ul className="space-y-2.5">
              {refundTop.map((r) => (
                <li key={r.restaurantId} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/superadmin/restaurants/${r.restaurantId}`} className="min-w-0 truncate font-medium text-ink hover:text-brand-600 hover:underline">
                    {refundNames.get(r.restaurantId) ?? "—"}
                  </Link>
                  <span className="shrink-0 text-ink/55">{r._count._all} · {formatMoney(toNumber(r._sum.amount ?? 0))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
