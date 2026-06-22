import { redirect } from "next/navigation";
import { requireSuperAdmin, updatePlanPricingAction } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { allPlanPricing } from "@/lib/plan-settings";

export default async function PlansPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "billing.manage")) redirect("/superadmin");
  const plans = await allPlanPricing();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Plan pricing</h1>
        <p className="text-sm text-ink/45">
          Change prices and trial length live — no deploy. Capabilities and allowances stay fixed per tier.
        </p>
      </div>

      <div className="space-y-3">
        {plans.map((p) => (
          <form
            key={p.tier}
            action={updatePlanPricingAction}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-sand-200 bg-surface p-4"
          >
            <input type="hidden" name="tier" value={p.tier} />
            <div className="min-w-[100px]">
              <p className="font-medium text-ink">{p.name}</p>
              <p className="text-xs text-ink/45">{p.tier}{p.contactOnly ? " · contact-only" : ""}</p>
            </div>
            <label className="text-xs text-ink/55">
              Price ₹/mo
              <input
                name="price"
                type="number"
                min="0"
                defaultValue={p.price}
                className="mt-1 block w-28 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-ink/55">
              Trial days
              <input
                name="trialDays"
                type="number"
                min="0"
                max="365"
                defaultValue={p.trialDays}
                className="mt-1 block w-24 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm"
              />
            </label>
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
          </form>
        ))}
      </div>
      <p className="text-xs text-ink/40">+ 18% GST is applied on top at checkout. Changes take effect within ~30 seconds.</p>
    </div>
  );
}
