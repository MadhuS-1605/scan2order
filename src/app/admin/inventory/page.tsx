import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { InventoryManager } from "./inventory-manager";

export default async function InventoryPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("menu");

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ trackStock: "desc" }, { name: "asc" }],
  });

  const tracked = items.filter((i) => i.trackStock);
  const low = tracked.filter((i) => i.stockQty <= i.lowStockThreshold).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "inventory.title")}</h1>
        <p className="text-sm text-ink/45">
          {tracked.length} {t(d, "inventory.tracked")}
          {low > 0 && (
            <span className="text-brand-600"> · {low} {t(d, "inventory.lowOutOfStock")}</span>
          )}
        </p>
      </div>
      <InventoryManager
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          trackStock: i.trackStock,
          stockQty: i.stockQty,
          lowStockThreshold: i.lowStockThreshold,
        }))}
      />
    </div>
  );
}
