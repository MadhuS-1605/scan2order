import { Check } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { PLANS, planByTier } from "@/lib/plans";
import { setPlanAction } from "@/lib/platform/actions";
import { formatMoney } from "@/lib/utils";

export default async function BillingPage() {
  const { restaurant } = await getCurrentRestaurant("settings");
  const current = planByTier(restaurant.planTier);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Plan &amp; billing</h1>
        <p className="text-sm text-ink/45">
          You&apos;re on the{" "}
          <span className="font-medium text-ink">{current.name}</span> plan.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const active = p.tier === restaurant.planTier;
          return (
            <div
              key={p.tier}
              className={`flex flex-col rounded-2xl border bg-surface p-5 ${
                active
                  ? "border-brand-400 ring-2 ring-brand-300"
                  : p.highlight
                    ? "border-brand-200"
                    : "border-sand-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl text-ink">{p.name}</h2>
                {p.highlight && !active && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                    Popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink/55">{p.tagline}</p>
              <p className="mt-3 font-display text-3xl text-ink">
                {p.price === 0 ? "Free" : formatMoney(p.price)}
                {p.price > 0 && <span className="text-sm text-ink/45"> /mo</span>}
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
                {active ? (
                  <div className="rounded-lg bg-sand-100 py-2 text-center text-sm font-medium text-ink/60">
                    Current plan
                  </div>
                ) : (
                  <form action={setPlanAction}>
                    <input type="hidden" name="tier" value={p.tier} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                    >
                      {p.price === 0 ? "Switch to Free" : `Choose ${p.name}`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-ink/40">
        Changing a plan here updates your tier immediately. Online subscription
        billing (Razorpay) is coming soon.
      </p>
    </div>
  );
}
