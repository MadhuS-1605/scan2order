import Link from "next/link";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { PosClient } from "@/app/admin/orders/new/pos-client";

// Distraction-free order-taking for waiters on their own phone — same
// PosClient/createStaffOrderAction as /admin/orders/new, just without the
// full admin sidebar chrome (lives outside /admin so it isn't forced through
// that layout). Closes the "Captain App" gap vs. Restrora.
export default async function CaptainPage() {
  const session = await requireAdminWithPermission("orders");

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    include: { config: true },
  });
  if (!restaurant?.config) return null;

  const [tables, categories, items] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id, isActive: true, kind: { not: "COUNTER" } },
      orderBy: { label: "asc" },
      select: { id: true, label: true, kind: true },
    }),
    prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id, isAvailable: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, price: true, categoryId: true, isVeg: true },
    }),
  ]);

  return (
    <div className="min-h-screen bg-paper px-3 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-xl font-medium text-ink">{restaurant.name}</h1>
        <Link href="/admin/orders" className="text-sm text-ink/45 hover:text-ink">
          Full dashboard →
        </Link>
      </div>
      <PosClient
        currency={restaurant.config.currency}
        tables={tables.map((tbl) => ({
          id: tbl.id,
          label: tbl.kind === "ROOM" ? `Room ${tbl.label}` : tbl.label,
        }))}
        categories={categories}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          price: toNumber(i.price),
          categoryId: i.categoryId,
          isVeg: i.isVeg,
        }))}
      />
    </div>
  );
}
