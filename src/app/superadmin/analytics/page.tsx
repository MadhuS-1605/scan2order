import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { AnalyticsView, resolveRange } from "@/components/admin/analytics-view";
import { RestaurantPicker } from "@/components/superadmin/restaurant-picker";

export default async function SuperAdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ restaurant?: string; range?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const range = resolveRange(sp.range);

  // Every restaurant + its currency, so the super-admin can drill into any one.
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, config: { select: { currency: true } } },
  });

  if (restaurants.length === 0) {
    return <p className="text-sm text-ink/45">No restaurants yet.</p>;
  }

  // Default to the first restaurant; redirect so the URL always carries an id.
  const selected = restaurants.find((r) => r.id === sp.restaurant) ?? restaurants[0];
  if (!sp.restaurant) {
    redirect(`/superadmin/analytics?restaurant=${selected.id}&range=${range.key}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink/40">Analytics</p>
          <h1 className="font-display text-2xl font-medium text-ink">{selected.name}</h1>
        </div>
        <RestaurantPicker
          restaurants={restaurants.map((r) => ({ id: r.id, name: r.name }))}
          currentId={selected.id}
          range={range.key}
        />
      </div>
      <AnalyticsView
        restaurantId={selected.id}
        currency={selected.config?.currency ?? "INR"}
        rangeKey={range.key}
        rangeHref={(key) => `/superadmin/analytics?restaurant=${selected.id}&range=${key}`}
      />
    </div>
  );
}
