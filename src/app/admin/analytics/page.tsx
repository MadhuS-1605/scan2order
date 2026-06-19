import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { AnalyticsView, resolveRange } from "@/components/admin/analytics-view";

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("analytics");
  const sp = await searchParams;
  const range = resolveRange(sp.range);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-medium text-ink">{t(d, "analytics.title")}</h1>
      <AnalyticsView
        restaurantId={restaurant.id}
        currency={restaurant.config!.currency}
        rangeKey={range.key}
        rangeHref={(key) => `/admin/analytics?range=${key}`}
      />
    </div>
  );
}
