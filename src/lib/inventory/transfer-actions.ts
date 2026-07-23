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

  await prisma.$transaction(async (tx) => {
    // Guarded decrement (mirrors the order-placement oversell guard in
    // src/lib/customer/actions.ts): two concurrent transfers of the same
    // ingredient could both pass the plain-read check above before either
    // writes, driving stock negative. Aborting on affected-row-count === 0
    // makes the decrement atomic against that race.
    const decremented = await tx.ingredient.updateMany({
      where: { id: from.id, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (decremented.count === 0) throw new Error("Not enough stock to transfer.");

    const to = await tx.ingredient.upsert({
      where: { restaurantId_name: { restaurantId: toRestaurantId, name: from.name } },
      create: { restaurantId: toRestaurantId, name: from.name, unit: from.unit, costPerUnit: from.costPerUnit },
      update: {},
    });
    await tx.ingredient.update({ where: { id: to.id }, data: { stockQty: { increment: qty } } });
    await tx.ingredientLedgerEntry.create({
      data: {
        restaurantId: session.restaurantId,
        ingredientId: from.id,
        delta: -qty,
        reason: "TRANSFER_OUT",
        note: `to ${toRestaurantId.slice(-6)}`,
        createdByName: session.name,
      },
    });
    await tx.ingredientLedgerEntry.create({
      data: {
        restaurantId: toRestaurantId,
        ingredientId: to.id,
        delta: qty,
        reason: "TRANSFER_IN",
        note: `from ${session.restaurantId.slice(-6)}`,
        createdByName: session.name,
      },
    });
  }).catch((e) => {
    if (e instanceof Error && e.message === "Not enough stock to transfer.") return;
    throw e;
  });
  revalidatePath("/admin/inventory/recipes");
  revalidatePath("/admin/inventory/reports");
}
