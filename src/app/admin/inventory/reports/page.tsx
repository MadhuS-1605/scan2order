import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { toNumber, formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui";

export default async function InventoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { restaurant, config } = await getCurrentRestaurant("menu");
  const { days: daysParam } = await searchParams;
  const days = Math.max(1, Math.min(90, Number(daysParam) || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const [ingredients, entries] = await Promise.all([
    prisma.ingredient.findMany({ where: { restaurantId: restaurant.id } }),
    prisma.ingredientLedgerEntry.findMany({
      where: { restaurantId: restaurant.id, createdAt: { gte: since } },
    }),
  ]);

  const rows = ingredients.map((ing) => {
    const own = entries.filter((e) => e.ingredientId === ing.id);
    const consumed = -own.filter((e) => e.reason === "ORDER_CONSUMPTION").reduce((s, e) => s + toNumber(e.delta), 0);
    const wasted = -own.filter((e) => e.reason === "WASTAGE").reduce((s, e) => s + toNumber(e.delta), 0);
    const restocked = own.filter((e) => e.reason === "RESTOCK").reduce((s, e) => s + toNumber(e.delta), 0);
    const cost = toNumber(ing.costPerUnit);
    return {
      id: ing.id,
      name: ing.name,
      unit: ing.unit,
      consumed,
      wasted,
      restocked,
      consumedCost: consumed * cost,
      wastedCost: wasted * cost,
    };
  });

  const totalUsageCost = rows.reduce((s, r) => s + r.consumedCost, 0);
  const totalWasteCost = rows.reduce((s, r) => s + r.wastedCost, 0);
  const cur = config.currency;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/inventory/recipes" className="text-sm text-ink/45 hover:text-ink">
          ← Recipes & ingredients
        </Link>
        <h1 className="font-display text-3xl font-medium text-ink">Inventory report</h1>
        <p className="text-sm text-ink/45">Usage, wastage and cost over the last {days} days.</p>
      </div>

      <div className="flex gap-2 text-sm">
        {[7, 30, 90].map((n) => (
          <Link
            key={n}
            href={`/admin/inventory/reports?days=${n}`}
            className={`rounded-lg border px-3 py-1.5 ${
              days === n ? "border-brand-400 bg-brand-50 text-brand-700" : "border-sand-300 text-ink/60"
            }`}
          >
            {n}d
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink/45">Usage cost</p>
          <p className="mt-1 font-display text-2xl text-ink">{formatMoney(totalUsageCost, cur)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink/45">Wastage cost</p>
          <p className="mt-1 font-display text-2xl text-red-600">{formatMoney(totalWasteCost, cur)}</p>
        </Card>
      </div>

      <Card className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-sand-100 text-left text-xs uppercase tracking-wide text-ink/45">
              <th className="p-3">Ingredient</th>
              <th className="p-3">Used</th>
              <th className="p-3">Wasted</th>
              <th className="p-3">Restocked</th>
              <th className="p-3">Usage cost</th>
              <th className="p-3">Waste cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-sand-100 last:border-0">
                <td className="p-3 font-medium text-ink">{r.name}</td>
                <td className="p-3 text-ink/70">{r.consumed.toFixed(2)} {r.unit}</td>
                <td className="p-3 text-ink/70">{r.wasted.toFixed(2)} {r.unit}</td>
                <td className="p-3 text-ink/70">{r.restocked.toFixed(2)} {r.unit}</td>
                <td className="p-3 text-ink/70">{formatMoney(r.consumedCost, cur)}</td>
                <td className="p-3 text-red-600">{formatMoney(r.wastedCost, cur)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-ink/45">
                  No ingredients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
