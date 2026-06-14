import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { InventoryManager } from "./inventory-manager";

export default async function InventoryPage() {
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
        <h1 className="font-display text-3xl font-medium text-ink">Inventory</h1>
        <p className="text-sm text-ink/45">
          {tracked.length} tracked
          {low > 0 && (
            <span className="text-brand-600"> · {low} low / out of stock</span>
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
