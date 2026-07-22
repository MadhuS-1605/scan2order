"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/validation";

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

// Copies a modifier group (and its options) from one item onto N other items —
// so "Spice level" doesn't have to be re-typed by hand on every dish that needs it.
export async function copyModifierGroupToItemsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const sourceGroupId = String(formData.get("sourceGroupId") ?? "");
  const targetItemIds = String(formData.get("targetItemIds") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const source = await prisma.modifierGroup.findFirst({
    where: { id: sourceGroupId, menuItem: { restaurantId } },
    include: { options: true },
  });
  if (!source) return { error: "Modifier group not found." };

  const otherIds = targetItemIds.filter((id) => id !== source.menuItemId);
  if (otherIds.length === 0) {
    return { error: "Select at least one other item to apply it to." };
  }
  const targets = await prisma.menuItem.findMany({
    where: { id: { in: otherIds }, restaurantId },
    select: { id: true },
  });
  if (targets.length === 0) return { error: "No matching items found." };

  for (const t of targets) {
    const count = await prisma.modifierGroup.count({ where: { menuItemId: t.id } });
    const group = await prisma.modifierGroup.create({
      data: {
        menuItemId: t.id,
        name: source.name,
        required: source.required,
        minSelect: source.minSelect,
        maxSelect: source.maxSelect,
        sortOrder: count,
        translations: source.translations ?? undefined,
      },
    });
    if (source.options.length) {
      await prisma.modifierOption.createMany({
        data: source.options.map((o, i) => ({
          groupId: group.id,
          name: o.name,
          priceDelta: o.priceDelta,
          sortOrder: i,
          translations: o.translations ?? undefined,
        })),
      });
    }
  }
  revalidate();
  return {
    ok: true,
    message: `Applied "${source.name}" to ${targets.length} item${targets.length === 1 ? "" : "s"}.`,
  };
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
