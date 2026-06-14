import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { PosClient } from "./pos-client";

export default async function NewOrderPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");

  const [tables, categories, items] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">New order</h1>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> Orders
        </Link>
      </div>
      <PosClient
        currency={config.currency}
        tables={tables.map((t) => ({
          id: t.id,
          label: t.kind === "ROOM" ? `Room ${t.label}` : t.label,
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
