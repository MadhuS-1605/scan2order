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

export async function addModifierGroupAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const menuItemId = String(formData.get("menuItemId"));
  const name = String(formData.get("name") ?? "").trim();
  const required = formData.get("required") === "on";
  const maxSelect = Math.max(1, Number(formData.get("maxSelect") ?? 1) || 1);
  if (!name || !(await ownsItem(menuItemId, restaurantId))) return;

  const count = await prisma.modifierGroup.count({ where: { menuItemId } });
  await prisma.modifierGroup.create({
    data: {
      menuItemId,
      name,
      required,
      minSelect: required ? 1 : 0,
      maxSelect: required ? 1 : maxSelect,
      sortOrder: count,
    },
  });
  revalidate();
}

export async function deleteModifierGroupAction(
  formData: FormData,
): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  await prisma.modifierGroup.deleteMany({
    where: { id, menuItem: { restaurantId } },
  });
  revalidate();
}

export async function addModifierOptionAction(
  formData: FormData,
): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const groupId = String(formData.get("groupId"));
  const name = String(formData.get("name") ?? "").trim();
  const priceDelta = Number(formData.get("priceDelta") ?? 0) || 0;
  if (!name) return;

  const group = await prisma.modifierGroup.findFirst({
    where: { id: groupId, menuItem: { restaurantId } },
    select: { id: true },
  });
  if (!group) return;

  const count = await prisma.modifierOption.count({ where: { groupId } });
  await prisma.modifierOption.create({
    data: { groupId, name, priceDelta, sortOrder: count },
  });
  revalidate();
}

export async function deleteModifierOptionAction(
  formData: FormData,
): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  await prisma.modifierOption.deleteMany({
    where: { id, group: { menuItem: { restaurantId } } },
  });
  revalidate();
}
