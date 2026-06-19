import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { PosClient } from "./pos-client";

export default async function NewOrderPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

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
        <h1 className="font-display text-3xl font-medium text-ink">
          {t(d, "newOrder.title")}
        </h1>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> {t(d, "newOrder.orders")}
        </Link>
      </div>
      <PosClient
        currency={config.currency}
        tables={tables.map((tbl) => ({
          id: tbl.id,
          label:
            tbl.kind === "ROOM"
              ? `${t(d, "newOrder.room")} ${tbl.label}`
              : tbl.label,
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
