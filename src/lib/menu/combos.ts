"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";

function revalidate() {
  revalidatePath("/admin/menu");
}

async function ownsItem(menuItemId: string, restaurantId: string) {
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId },
    select: { id: true },
  });
  return Boolean(item);
}

// Marks/unmarks an item as a combo. Turning it off drops any existing combo
// lines (a non-combo item has nothing to list as "included").
export async function setIsComboAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const menuItemId = String(formData.get("menuItemId"));
  const isCombo = formData.get("isCombo") === "on";
  if (!(await ownsItem(menuItemId, restaurantId))) return;

  await prisma.menuItem.update({ where: { id: menuItemId }, data: { isCombo } });
  if (!isCombo) {
    await prisma.comboLine.deleteMany({ where: { comboId: menuItemId } });
  }
  revalidate();
}

export async function addComboLineAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const comboId = String(formData.get("comboId"));
  const includedItemId = String(formData.get("includedItemId"));
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);
  if (comboId === includedItemId) return; // can't include itself
  if (!(await ownsItem(comboId, restaurantId)) || !(await ownsItem(includedItemId, restaurantId))) return;

  const count = await prisma.comboLine.count({ where: { comboId } });
  await prisma.comboLine.create({
    data: { comboId, includedItemId, quantity, sortOrder: count },
  });
  revalidate();
}

export async function deleteComboLineAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  await prisma.comboLine.deleteMany({ where: { id, combo: { restaurantId } } });
  revalidate();
}
