import Link from "next/link";
import { RotateCcw, Clock, CreditCard, MessageSquare, Bug, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { formatMoney, toNumber } from "@/lib/utils";
import { StatCard } from "@/components/superadmin/stat-card";

const CHANNEL_LABEL: Record<string, string> = { EMAIL: "Email", WHATSAPP: "WhatsApp", SMS: "SMS" };
const RECONCILE_LABEL: Record<string, string> = {
  LATE_WEBHOOK_RECOVERED: "Late webhook recovered",
  UNMATCHED_PAYMENT: "Unmatched payment",
  UNMATCHED_SUBSCRIPTION: "Unmatched subscription",
};

export default async function PlatformHealthPage() {
  await requireSuperAdmin();

  const start30 = new Date();
  start30.setDate(start30.getDate() - 30);
  // Online-payment intents stuck PENDING beyond this are awaiting the sweep.
  const staleCutoff = new Date();
  staleCutoff.setMinutes(staleCutoff.getMinutes() - 30);

  const start7 = new Date(Date.now() - 7 * 86_400_000);
  const start24h = new Date(Date.now() - 86_400_000);

  const [
    planFailed,
    payFailed30,
    refundAll,
    refund30,
    refundTop,
    stalePending,
    deliveryAttempts,
    deliveryFailures,
    recentFailures,
    reconcileEvents,
    recentReconcileEvents,
    errorCount24h,
    errorContexts,
    recentErrors,
  ] = await Promise.all([
    prisma.planPayment.count({ where: { status: "FAILED" } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: start30 } } }),
    prisma.refund.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.refund.aggregate({ where: { createdAt: { gte: start30 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.refund.groupBy({ by: ["restaurantId"], _count: { _all: true }, _sum: { amount: true }, orderBy: { _count: { restaurantId: "desc" } }, take: 5 }),
    prisma.order.count({ where: { paymentStatus: "PENDING", status: { not: "CANCELLED" }, updatedAt: { lt: staleCutoff } } }),
    prisma.messageDeliveryLog.groupBy({ by: ["channel"], where: { createdAt: { gte: start7 }, mocked: false }, _count: { _all: true } }),
    prisma.messageDeliveryLog.groupBy({ by: ["channel"], where: { createdAt: { gte: start7 }, mocked: false, ok: false }, _count: { _all: true } }),
    prisma.messageDeliveryLog.findMany({
      where: { createdAt: { gte: start7 }, mocked: false, ok: false },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.paymentReconciliationEvent.count({ where: { createdAt: { gte: start30 } } }),
    prisma.paymentReconciliationEvent.findMany({ where: { createdAt: { gte: start30 } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.errorLogEntry.count({ where: { createdAt: { gte: start24h } } }),
    prisma.errorLogEntry.groupBy({ by: ["context"], where: { createdAt: { gte: start24h } }, _count: { _all: true }, orderBy: { _count: { context: "desc" } }, take: 5 }),
    prisma.errorLogEntry.findMany({ where: { createdAt: { gte: start24h } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const attemptsByChannel = new Map(deliveryAttempts.map((d) => [d.channel, d._count._all]));
  const failuresByChannel = new Map(deliveryFailures.map((d) => [d.channel, d._count._all]));
  const channels = ["EMAIL", "WHATSAPP", "SMS"] as const;

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
        <p className="text-sm text-ink/45">Payments, refunds, stuck orders, messaging delivery, and service configuration.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Stuck payments" value={String(stalePending)} sub="PENDING >30 min (awaiting sweep)" icon={Clock} alert={stalePending > 0} />
        <StatCard label="Failed plan payments" value={String(planFailed)} sub="all-time" icon={CreditCard} alert={planFailed > 0} />
        <StatCard label="Failed diner payments" value={String(payFailed30)} sub="last 30 days" icon={CreditCard} alert={payFailed30 > 0} />
        <StatCard label="Refunds" value={formatMoney(toNumber(refund30._sum.amount ?? 0))} sub={`${refund30._count._all} in 30d · ${refundAll._count._all} all-time`} icon={RotateCcw} />
        <StatCard label="Reconciliation events" value={String(reconcileEvents)} sub="last 30 days" icon={ShieldAlert} alert={reconcileEvents > 0} />
        <StatCard label="Errors" value={String(errorCount24h)} sub="last 24 hours" icon={Bug} alert={errorCount24h > 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Messaging delivery */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
            <MessageSquare className="h-4 w-4 text-brand-600" /> Messaging delivery (7d)
          </h2>
          <ul className="space-y-2 text-sm">
            {channels.map((c) => {
              const attempts = attemptsByChannel.get(c) ?? 0;
              const failures = failuresByChannel.get(c) ?? 0;
              const pct = attempts ? Math.round((failures / attempts) * 100) : 0;
              return (
                <li key={c} className="flex items-center justify-between">
                  <span className="text-ink/70">{CHANNEL_LABEL[c]}</span>
                  <span className={`text-xs ${pct > 5 ? "font-medium text-red-700" : "text-ink/55"}`}>
                    {attempts === 0 ? "no sends" : `${failures}/${attempts} failed (${pct}%)`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Recent delivery failures */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">Recent delivery failures</h2>
          {recentFailures.length === 0 ? (
            <p className="text-sm text-ink/45">No failures in the last 7 days.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentFailures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-ink/70">{f.error ?? "Unknown error"}</span>
                  <span className="shrink-0 text-xs text-ink/45">
                    {CHANNEL_LABEL[f.channel]} · {f.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Payment reconciliation */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
            <ShieldAlert className="h-4 w-4 text-brand-600" /> Payment reconciliation (30d)
          </h2>
          {recentReconcileEvents.length === 0 ? (
            <p className="text-sm text-ink/45">No reconciliation events — webhooks matching cleanly.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {recentReconcileEvents.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 truncate text-ink/70">{RECONCILE_LABEL[ev.type] ?? ev.type}{ev.detail ? ` — ${ev.detail}` : ""}</span>
                  <span className="shrink-0 text-xs text-ink/45">
                    {ev.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Errors */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
            <Bug className="h-4 w-4 text-brand-600" /> Errors (24h)
          </h2>
          {errorContexts.length === 0 ? (
            <p className="text-sm text-ink/45">No errors logged in the last 24 hours.</p>
          ) : (
            <>
              <ul className="space-y-1.5 text-sm">
                {errorContexts.map((c) => (
                  <li key={c.context} className="flex justify-between">
                    <span className="text-ink/70">{c.context}</span>
                    <span className="font-medium text-ink">{c._count._all}</span>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 space-y-1.5 border-t border-sand-100 pt-3 text-xs text-ink/50">
                {recentErrors.slice(0, 4).map((e) => (
                  <li key={e.id} className="truncate">{e.context}: {e.message}</li>
                ))}
              </ul>
            </>
          )}
        </div>
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
