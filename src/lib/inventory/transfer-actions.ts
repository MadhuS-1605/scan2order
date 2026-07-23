"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";

// Moves ingredient stock from the current outlet to a sibling outlet in the
// same PropertyGroup — closes the "Stock Transfer" gap vs. competitors.
// Matches the destination ingredient by name (creating it there if it
// doesn't exist yet, same unit) since Ingredient rows are per-restaurant,
// not shared across a group.
export async function transferIngredientStockAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "properties") || !hasPermission(session.role, "menu")) return;

  const ingredientId = String(formData.get("ingredientId"));
  const toRestaurantId = String(formData.get("toRestaurantId"));
  const qty = Math.max(0, Number(formData.get("qty") ?? 0) || 0);
  if (!ingredientId || !toRestaurantId || qty <= 0) return;

  const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { groupId: true } });
  const from = await prisma.ingredient.findFirst({
    where: { id: ingredientId, restaurantId: session.restaurantId },
  });
  const toRestaurant = await prisma.restaurant.findUnique({
    where: { id: toRestaurantId },
    select: { id: true, groupId: true },
  });
  // Both outlets must be in the same group as the acting admin — a stray
  // restaurantId elsewhere on the platform can't be used as a transfer target.
  if (!from || !me?.groupId || !toRestaurant || toRestaurant.groupId !== me.groupId) return;
  if (from.stockQty.toNumber() < qty) return;

  const to = await prisma.ingredient.upsert({
    where: { restaurantId_name: { restaurantId: toRestaurantId, name: from.name } },
    create: { restaurantId: toRestaurantId, name: from.name, unit: from.unit, costPerUnit: from.costPerUnit },
    update: {},
  });

  await prisma.$transaction([
    prisma.ingredient.update({ where: { id: from.id }, data: { stockQty: { decrement: qty } } }),
    prisma.ingredient.update({ where: { id: to.id }, data: { stockQty: { increment: qty } } }),
    prisma.ingredientLedgerEntry.create({
      data: {
        restaurantId: session.restaurantId,
        ingredientId: from.id,
        delta: -qty,
        reason: "TRANSFER_OUT",
        note: `to ${toRestaurantId.slice(-6)}`,
        createdByName: session.name,
      },
    }),
    prisma.ingredientLedgerEntry.create({
      data: {
        restaurantId: toRestaurantId,
        ingredientId: to.id,
        delta: qty,
        reason: "TRANSFER_IN",
        note: `from ${session.restaurantId.slice(-6)}`,
        createdByName: session.name,
      },
    }),
  ]);
  revalidatePath("/admin/inventory/recipes");
  revalidatePath("/admin/inventory/reports");
}
