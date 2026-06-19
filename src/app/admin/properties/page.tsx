import { Building2, Check } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { switchPropertyAction } from "@/lib/properties/actions";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui";
import { AddPropertyForm } from "./add-property-form";

const TYPE_LABEL_KEYS: Record<string, string> = {
  RESTAURANT: "properties.typeRestaurant",
  CAFE: "properties.typeCafe",
  HOTEL: "properties.typeHotel",
  CLOUD_KITCHEN: "properties.typeCloudKitchen",
  BAR: "properties.typeBar",
};

export default async function PropertiesPage() {
  const { restaurant, session } = await getCurrentRestaurant("properties");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  const me = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { groupId: true },
  });

  // All properties the owner manages — the group, or just the current one.
  const properties = me?.groupId
    ? await prisma.restaurant.findMany({
        where: { groupId: me.groupId },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, city: true, type: true },
      })
    : [{ id: restaurant.id, name: restaurant.name, city: restaurant.city, type: restaurant.type }];

  // Today's roll-up (revenue + order count) per property.
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const stats = await prisma.order.groupBy({
    by: ["restaurantId"],
    where: {
      restaurantId: { in: properties.map((p) => p.id) },
      createdAt: { gte: start },
      status: { not: "CANCELLED" },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  const statMap = new Map(
    stats.map((s) => [
      s.restaurantId,
      { orders: s._count._all, revenue: Number(s._sum.totalAmount ?? 0) },
    ]),
  );

  const totalOrders = stats.reduce((a, s) => a + s._count._all, 0);
  const totalRevenue = stats.reduce((a, s) => a + Number(s._sum.totalAmount ?? 0), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "properties.title")}</h1>
        <p className="text-sm text-ink/45">
          {t(d, "properties.subtitle")}
        </p>
      </div>

      {properties.length > 1 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <p className="text-xs uppercase tracking-wide text-ink/45">
              {`${t(d, "properties.todayAcross")} ${properties.length} ${t(d, "properties.propertiesWord")}`}
            </p>
            <p className="font-display text-3xl text-ink">
              {formatMoney(totalRevenue)}
            </p>
            <p className="text-sm text-ink/50">{`${totalOrders} ${t(d, "properties.orders")}`}</p>
          </Card>
        </div>
      )}

      <div className="space-y-3">
        {properties.map((p) => {
          const s = statMap.get(p.id) ?? { orders: 0, revenue: 0 };
          const active = p.id === restaurant.id;
          return (
            <Card
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 ${
                active ? "ring-2 ring-brand-400" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Building2 className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-medium text-ink">{p.name}</p>
                  <p className="text-xs text-ink/50">
                    {TYPE_LABEL_KEYS[p.type] ? t(d, TYPE_LABEL_KEYS[p.type]) : p.type}
                    {p.city && ` · ${p.city}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-medium text-ink">
                    {formatMoney(s.revenue)}
                  </p>
                  <p className="text-xs text-ink/45">{`${s.orders} ${t(d, "common.today")}`}</p>
                </div>
                {active ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">
                    <Check className="h-4 w-4" /> {t(d, "properties.active")}
                  </span>
                ) : (
                  <form action={switchPropertyAction}>
                    <input type="hidden" name="restaurantId" value={p.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-sand-300 bg-surface px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-sand-100"
                    >
                      {t(d, "properties.switch")}
                    </button>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <AddPropertyForm />
    </div>
  );
}
