import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/permissions";
import { RecipeManager } from "./recipe-manager";
import { TransferStockForm } from "./transfer-stock-form";

export default async function RecipesPage() {
  const { restaurant, session } = await getCurrentRestaurant("menu");

  const [ingredients, menuItems, me] = await Promise.all([
    prisma.ingredient.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { name: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      include: { recipeLines: true },
      orderBy: { name: "asc" },
    }),
    prisma.adminUser.findUnique({ where: { id: session.sub }, select: { groupId: true } }),
  ]);
  const siblings =
    me?.groupId && hasPermission(session.role, "properties")
      ? await prisma.restaurant.findMany({
          where: { groupId: me.groupId, id: { not: restaurant.id } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/inventory" className="text-sm text-ink/45 hover:text-ink">
          ← Inventory
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-medium text-ink">Recipes & ingredients</h1>
            <p className="text-sm text-ink/45">
              Track raw materials and how much of each a dish uses per serving — stock is deducted
              automatically as orders come in.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/inventory/suppliers"
              className="rounded-lg border border-sand-300 bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300"
            >
              Suppliers & POs →
            </Link>
            <Link
              href="/admin/inventory/reports"
              className="rounded-lg border border-sand-300 bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-brand-300"
            >
              Usage & wastage report →
            </Link>
          </div>
        </div>
      </div>
      <RecipeManager
        ingredients={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          unit: i.unit,
          stockQty: toNumber(i.stockQty),
          lowStockThreshold: toNumber(i.lowStockThreshold),
          costPerUnit: toNumber(i.costPerUnit),
        }))}
        menuItems={menuItems.map((m) => ({
          id: m.id,
          name: m.name,
          recipeLines: m.recipeLines.map((r) => ({
            id: r.id,
            ingredientId: r.ingredientId,
            qtyPerServing: toNumber(r.qtyPerServing),
          })),
        }))}
      />
      {siblings.length > 0 && ingredients.length > 0 && (
        <TransferStockForm
          ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit }))}
          outlets={siblings}
        />
      )}
    </div>
  );
}
