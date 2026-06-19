"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";

function revalidate() {
  revalidatePath("/admin/menu");
}

// Collect per-language name overrides from tr_<lang>_name fields into the
// translations JSON shape used across the app ({ hi: { name }, … }).
function collectTranslations(formData: FormData): Record<string, { name: string }> {
  const t: Record<string, { name: string }> = {};
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^tr_([a-z]{2})_name$/);
    if (!m) continue;
    const val = String(v).trim();
    if (val) t[m[1]] = { name: val };
  }
  return t;
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
  const tr = collectTranslations(formData);
  await prisma.modifierGroup.create({
    data: {
      menuItemId,
      name,
      required,
      minSelect: required ? 1 : 0,
      maxSelect: required ? 1 : maxSelect,
      sortOrder: count,
      translations: Object.keys(tr).length ? tr : undefined,
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
  const tr = collectTranslations(formData);
  await prisma.modifierOption.create({
    data: {
      groupId,
      name,
      priceDelta,
      sortOrder: count,
      translations: Object.keys(tr).length ? tr : undefined,
    },
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
