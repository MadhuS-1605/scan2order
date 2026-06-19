import { Check } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { PLANS, planByTier } from "@/lib/plans";
import { subscriptionState } from "@/lib/subscription";
import { downgradeToFreeAction } from "@/lib/billing/subscription-actions";
import { formatMoney } from "@/lib/utils";
import { PlanCheckout } from "./plan-checkout";
import { AutoRenew } from "./auto-renew";

export default async function BillingPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("settings");
  const sub = subscriptionState(restaurant);
  const current = planByTier(sub.tier);

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

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
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
      <p className="text-xs text-ink/40">
        {t(d, "billing.billingNote")}
      </p>
    </div>
  );
}
