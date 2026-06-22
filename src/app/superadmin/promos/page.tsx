import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  requireSuperAdmin,
  createPlanCouponAction,
  togglePlanCouponAction,
  deletePlanCouponAction,
} from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { toNumber } from "@/lib/utils";

export default async function PromosPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "billing.manage")) redirect("/superadmin");
  const coupons = await prisma.planCoupon.findMany({ orderBy: { createdAt: "desc" } });

  const fmt = (dt: Date) => dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Promo codes</h1>
        <p className="text-sm text-ink/45">Discount codes applied at subscription checkout (not diner coupons).</p>
      </div>

      <form action={createPlanCouponAction} className="flex flex-wrap items-end gap-3 rounded-2xl border border-sand-200 bg-surface p-5">
        <label className="text-xs text-ink/55">Code
          <input name="code" required placeholder="LAUNCH50" className="mt-1 block w-32 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm uppercase" />
        </label>
        <label className="text-xs text-ink/55">Type
          <select name="type" defaultValue="PERCENT" className="mt-1 block rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm">
            <option value="PERCENT">% off</option>
            <option value="AMOUNT">₹ off</option>
          </select>
        </label>
        <label className="text-xs text-ink/55">Value
          <input name="value" type="number" min="1" step="0.01" required className="mt-1 block w-24 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-ink/55">Max uses
          <input name="maxRedemptions" type="number" min="1" placeholder="∞" className="mt-1 block w-24 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs text-ink/55">Expires
          <input name="expiresAt" type="date" className="mt-1 block rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm" />
        </label>
        <button type="submit" className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Create</button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Discount</th>
              <th className="px-4 py-2.5">Used</th>
              <th className="px-4 py-2.5">Expires</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {coupons.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink/45">No promo codes yet.</td></tr>
            ) : (
              coupons.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 font-mono font-medium text-ink">{c.code}</td>
                  <td className="px-4 py-2.5 text-ink/70">{c.type === "PERCENT" ? `${toNumber(c.value)}%` : `₹${toNumber(c.value)}`}</td>
                  <td className="px-4 py-2.5 text-ink/70">{c.redeemedCount}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ""}</td>
                  <td className="px-4 py-2.5 text-ink/55">{c.expiresAt ? fmt(c.expiresAt) : "—"}</td>
                  <td className="px-4 py-2.5">
                    {c.active ? (
                      <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">Active</span>
                    ) : (
                      <span className="rounded-full bg-sand-100 px-2 py-0.5 text-xs text-ink/55">Off</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <form action={togglePlanCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="active" value={(!c.active).toString()} />
                        <button type="submit" className="rounded-md border border-sand-300 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-sand-100">{c.active ? "Disable" : "Enable"}</button>
                      </form>
                      <form action={deletePlanCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
