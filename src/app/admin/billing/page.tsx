import { Check } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { getCurrentRestaurant } from "@/lib/restaurant";
import {
  planByTier,
  allowanceForTier,
  overageBreakdown,
  overageCost,
  withGst,
  OVERAGE_RATE,
} from "@/lib/plans";
import { subscriptionState } from "@/lib/subscription";
import { resolvePlans } from "@/lib/plan-settings";
import { currentUsage } from "@/lib/usage";
import { getOutstandingOverage } from "@/lib/billing/overage";
import { downgradeToFreeAction } from "@/lib/billing/subscription-actions";
import { formatMoney, toNumber } from "@/lib/utils";
import { PlanCheckout } from "./plan-checkout";
import { AutoRenew } from "./auto-renew";
import { OverageSettle } from "./overage-settle";

export default async function BillingPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("settings");
  const sub = subscriptionState(restaurant);
  const current = planByTier(sub.tier);
  const plans = await resolvePlans();

  // Usage is metered + allowanced against the tier actually in force (a lapsed
  // plan soft-downgrades to FREE allowances, matching the capability gate).
  const usage = await currentUsage(restaurant.id);
  const usageTier = sub.effectiveTier;
  const allowance = allowanceForTier(usageTier);
  const overBreak = overageBreakdown(usage, usageTier);
  const overTotal = overageCost(usage, usageTier);
  const monthLabel = new Date().toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Paid history with downloadable GST invoices.
  const [planPayments, overagePayments] = await Promise.all([
    prisma.planPayment.findMany({
      where: { restaurantId: restaurant.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, tier: true, amount: true, createdAt: true },
    }),
    prisma.overageCharge.findMany({
      where: { restaurantId: restaurant.id, status: "PAID" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, period: true, amount: true, createdAt: true },
    }),
  ]);
  const invoices = [
    ...planPayments.map((p) => ({ id: p.id, kind: "plan" as const, label: `${planByTier(p.tier).name} plan`, amount: toNumber(p.amount), at: p.createdAt })),
    ...overagePayments.map((o) => ({ id: o.id, kind: "overage" as const, label: `Usage overage · ${o.period}`, amount: toNumber(o.amount), at: o.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  // Closed-month overage that's billable now (read-only — charges are created
  // at settle time, see src/lib/billing/overage.ts).
  const outstanding = await getOutstandingOverage(restaurant.id);

  const dayWord = (n: number | null | undefined) =>
    n === 1 ? t(d, "billing.day") : t(d, "billing.days");
  const statusLine =
    sub.status === "TRIAL"
      ? `${t(d, "billing.freeTrialOf")} ${current.name} — ${sub.daysLeft} ${dayWord(sub.daysLeft)} ${t(d, "billing.left")}`
      : sub.status === "ACTIVE"
        ? `${current.name} ${t(d, "billing.planRenewsIn")} ${sub.daysLeft} ${dayWord(sub.daysLeft)}.`
        : sub.status === "EXPIRED"
          ? `${t(d, "billing.expiredLine.before")} ${current.name} ${t(d, "billing.expiredLine.after")}`
          : t(d, "billing.onFreePlan");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "billing.title")}</h1>
        <p className="text-sm text-ink/45">{statusLine}</p>
      </div>

      {(sub.status === "EXPIRED" || (sub.status === "TRIAL" && (sub.daysLeft ?? 0) <= 3)) && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            sub.status === "EXPIRED"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {sub.status === "EXPIRED"
            ? t(d, "billing.renewToRestore")
            : `${t(d, "billing.trialEndsIn")} ${sub.daysLeft} ${dayWord(sub.daysLeft)} — ${t(d, "billing.subscribeToKeep")}`}
        </div>
      )}

      {outstanding.total > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-amber-900">
                {t(d, "billing.usageOutstanding")}{" "}
                {formatMoney(outstanding.total)}
              </p>
              <p className="mt-0.5 text-xs text-amber-700">
                {outstanding.months.map((m) => m.period).join(", ")} ·{" "}
                {t(d, "billing.usageOverageDesc")}
              </p>
            </div>
            <OverageSettle
              label={`${t(d, "billing.usageSettle")} · ${formatMoney(outstanding.total)}`}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-sand-200 bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl text-ink">
            {t(d, "billing.usageTitle")}
          </h2>
          <span className="text-xs text-ink/45">{monthLabel}</span>
        </div>
        <div className="mt-4 space-y-4">
          <UsageRow
            label={t(d, "billing.usageWhatsapp")}
            used={usage.whatsapp}
            allowance={allowance.whatsapp}
            overUnits={overBreak.whatsapp.units}
            rate={OVERAGE_RATE.whatsapp}
            unlimitedLabel={t(d, "billing.usageUnlimited")}
            eachLabel={t(d, "billing.usageEach")}
            overLabel={t(d, "billing.usageOver")}
          />
          <UsageRow
            label={t(d, "billing.usageEmail")}
            used={usage.email}
            allowance={allowance.email}
            overUnits={overBreak.email.units}
            rate={OVERAGE_RATE.email}
            unlimitedLabel={t(d, "billing.usageUnlimited")}
            eachLabel={t(d, "billing.usageEach")}
            overLabel={t(d, "billing.usageOver")}
          />
        </div>
        {overTotal > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t(d, "billing.usageOverageProjected")}{" "}
            <strong>{formatMoney(overTotal)}</strong>
            {" + "}
            {t(d, "billing.gst")} ({formatMoney(withGst(overTotal))}{" "}
            {t(d, "billing.usageInclGst")})
          </div>
        )}
        <p className="mt-3 text-xs text-ink/40">
          {t(d, "billing.usageNote")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.tier === sub.tier && sub.status !== "EXPIRED";
          const isFree = p.price === 0;
          return (
            <div
              key={p.tier}
              className={`flex flex-col rounded-2xl border bg-surface p-5 ${
                isCurrent
                  ? "border-brand-400 ring-2 ring-brand-300"
                  : p.highlight
                    ? "border-brand-200"
                    : "border-sand-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-ink">{p.name}</h2>
                {p.highlight && !isCurrent && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                    {t(d, "billing.popular")}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink/55">{p.tagline}</p>
              <p className="mt-3 font-display text-3xl text-ink">
                {isFree ? t(d, "billing.free") : formatMoney(p.price)}
                {!isFree && <span className="text-sm text-ink/45"> {t(d, "billing.perMo")}</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  isFree ? (
                    <div className="rounded-lg bg-sand-100 py-2 text-center text-sm font-medium text-ink/60">
                      {t(d, "billing.currentPlan")}
                    </div>
                  ) : (
                    <>
                      <PlanCheckout tier={p.tier} label={t(d, "billing.extend30Days")} variant="secondary" />
                      <AutoRenew tier={p.tier} enabled={restaurant.planAutoRenew} />
                    </>
                  )
                ) : isFree ? (
                  <form action={downgradeToFreeAction}>
                    <button
                      type="submit"
                      className="w-full rounded-lg border border-sand-300 py-2 text-sm font-medium text-ink/70 hover:bg-sand-100"
                    >
                      {t(d, "billing.switchToFree")}
                    </button>
                  </form>
                ) : (
                  <PlanCheckout
                    tier={p.tier}
                    label={
                      sub.status === "EXPIRED" && p.tier === sub.tier
                        ? t(d, "billing.renew")
                        : `${t(d, "billing.subscribe")} · ${formatMoney(p.price)}${t(d, "billing.perMoShort")}`
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {invoices.length > 0 && (
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-medium text-ink">{t(d, "billing.paymentHistory")}</h2>
          <ul className="divide-y divide-sand-100">
            {invoices.map((inv) => (
              <li key={`${inv.kind}-${inv.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="text-ink/80">{inv.label}</span>
                  <span className="ml-2 text-xs text-ink/40">
                    {inv.at.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-medium text-ink">{formatMoney(inv.amount)}</span>
                  <a href={`/api/billing/invoice/${inv.id}?kind=${inv.kind}`} target="_blank" rel="noopener" className="text-brand-600 hover:underline">
                    {t(d, "billing.invoice")}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-ink/40">
        {t(d, "billing.billingNote")}
      </p>
    </div>
  );
}

// One metered channel: used vs monthly allowance, with a bar and (when over the
// allowance) the overage units + per-unit rate.
function UsageRow({
  label,
  used,
  allowance,
  overUnits,
  rate,
  unlimitedLabel,
  eachLabel,
  overLabel,
}: {
  label: string;
  used: number;
  allowance: number | null;
  overUnits: number;
  rate: number;
  unlimitedLabel: string;
  eachLabel: string;
  overLabel: string;
}) {
  const unlimited = allowance === null;
  const over = overUnits > 0;
  // Bar fills toward the allowance; a 0-allowance channel reads full once used.
  const pct = unlimited
    ? used > 0
      ? 8
      : 0
    : allowance === 0
      ? used > 0
        ? 100
        : 0
      : Math.min(100, Math.round((used / allowance) * 100));
  const fmt = (n: number) => n.toLocaleString("en-IN");
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink/70">{label}</span>
        <span className="text-ink/55">
          {fmt(used)}
          {unlimited ? ` · ${unlimitedLabel}` : ` / ${fmt(allowance)}`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sand-100">
        <div
          className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-brand-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {over && (
        <p className="mt-1 text-xs text-amber-700">
          +{fmt(overUnits)} {overLabel} · {formatMoney(rate)} {eachLabel}
        </p>
      )}
    </div>
  );
}
