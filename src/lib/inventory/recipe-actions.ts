"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";

async function requireMenuManager() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "menu")) throw new Error("Not allowed");
  return session;
}

function revalidate() {
  revalidatePath("/admin/inventory/recipes");
}

export async function createIngredientAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  if (!name || !unit) return;
  const costPerUnit = Math.max(0, Number(formData.get("costPerUnit") ?? 0) || 0);
  await prisma.ingredient.create({
    data: { restaurantId: session.restaurantId, name, unit, costPerUnit },
  });
  revalidate();
}

export async function restockIngredientAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const amount = Number(formData.get("amount") ?? 0) || 0;
  if (amount === 0) return;
  const ing = await prisma.ingredient.findFirst({
    where: { id, restaurantId: session.restaurantId },
  });
  if (!ing) return;
  await prisma.$transaction([
    prisma.ingredient.update({ where: { id }, data: { stockQty: { increment: amount } } }),
    prisma.ingredientLedgerEntry.create({
      data: {
        restaurantId: session.restaurantId,
        ingredientId: id,
        delta: amount,
        reason: "RESTOCK",
        createdByName: session.name,
        costPerUnit: ing.costPerUnit,
      },
    }),
  ]);
  revalidate();
}

// Manual wastage entry (spillage/spoilage) — decrements stock and logs it
// separately from order consumption so the inventory report can tell them
// apart.
export async function recordWastageAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const qty = Math.abs(Number(formData.get("qty") ?? 0) || 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  if (qty === 0) return;
  const ing = await prisma.ingredient.findFirst({
    where: { id, restaurantId: session.restaurantId },
  });
  if (!ing) return;
  await prisma.$transaction([
    prisma.ingredient.update({ where: { id }, data: { stockQty: { decrement: qty } } }),
    prisma.ingredientLedgerEntry.create({
      data: {
        restaurantId: session.restaurantId,
        ingredientId: id,
        delta: -qty,
        reason: "WASTAGE",
        note,
        createdByName: session.name,
        costPerUnit: ing.costPerUnit,
      },
    }),
  ]);
  revalidate();
  revalidatePath("/admin/inventory/reports");
}

export async function setIngredientThresholdAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const lowStockThreshold = Math.max(0, Number(formData.get("lowStockThreshold") ?? 0) || 0);
  const costPerUnit = Math.max(0, Number(formData.get("costPerUnit") ?? 0) || 0);
  await prisma.ingredient.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { lowStockThreshold, costPerUnit },
  });
  revalidate();
}

export async function deleteIngredientAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  await prisma.ingredient.deleteMany({ where: { id, restaurantId: session.restaurantId } });
  revalidate();
}

// Upsert (add or update) how much of an ingredient one serving of a menu item
// consumes. A qty of 0 deletes the line.
export async function setRecipeLineAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const menuItemId = String(formData.get("menuItemId"));
  const ingredientId = String(formData.get("ingredientId"));
  const qtyPerServing = Math.max(0, Number(formData.get("qtyPerServing") ?? 0) || 0);
  const [item, ingredient] = await Promise.all([
    prisma.menuItem.findFirst({ where: { id: menuItemId, restaurantId: session.restaurantId } }),
    prisma.ingredient.findFirst({ where: { id: ingredientId, restaurantId: session.restaurantId } }),
  ]);
  if (!item || !ingredient) return;
  if (qtyPerServing === 0) {
    await prisma.recipeLine.deleteMany({ where: { menuItemId, ingredientId } });
  } else {
    await prisma.recipeLine.upsert({
      where: { menuItemId_ingredientId: { menuItemId, ingredientId } },
      create: { menuItemId, ingredientId, qtyPerServing },
      update: { qtyPerServing },
    });
  }
  revalidate();
}

export async function deleteRecipeLineAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  await prisma.recipeLine.deleteMany({
    where: { id, menuItem: { restaurantId: session.restaurantId } },
  });
  revalidate();
}
