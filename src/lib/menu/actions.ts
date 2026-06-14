"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { menuItemSchema, type ActionState } from "@/lib/validation";

function revalidateMenu() {
  revalidatePath("/admin/menu");
  revalidatePath("/onboarding");
}

export async function toggleAvailabilityAction(
  formData: FormData,
): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const item = await prisma.menuItem.findFirst({
    where: { id, restaurantId },
  });
  if (!item) return;
  await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: { isAvailable: !item.isAvailable },
  });
  revalidateMenu();
}

export async function toggleSpecialAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const item = await prisma.menuItem.findFirst({
    where: { id, restaurantId },
  });
  if (!item) return;
  await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: { isSpecialOfDay: !item.isSpecialOfDay },
  });
  revalidateMenu();
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  // Items keep existing (categoryId set null via FK rule).
  await prisma.menuCategory.deleteMany({ where: { id, restaurantId } });
  revalidateMenu();
}

export async function updateItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    categoryId: formData.get("categoryId"),
    imageUrl: formData.get("imageUrl"),
    availableFrom: formData.get("availableFrom"),
    availableTo: formData.get("availableTo"),
    isVeg: formData.get("isVeg") === "true",
    isAvailable: formData.get("isAvailable") === "true",
    isSpecialOfDay: formData.get("isSpecialOfDay") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const existing = await prisma.menuItem.findFirst({
    where: { id, restaurantId },
  });
  if (!existing) return { error: "Item not found" };

  // Collect per-language translations from tr_<lang>_name / tr_<lang>_desc.
  const translations: Record<string, { name?: string; description?: string }> = {};
  for (const [k, v] of formData.entries()) {
    const m = k.match(/^tr_([a-z]{2})_(name|desc)$/);
    if (!m) continue;
    const val = String(v).trim();
    if (!val) continue;
    const [, lang, field] = m;
    translations[lang] = translations[lang] ?? {};
    if (field === "name") translations[lang].name = val;
    else translations[lang].description = val;
  }

  await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: {
      name: d.name,
      description: d.description || null,
      price: d.price,
      categoryId: d.categoryId || null,
      imageUrl: d.imageUrl || null,
      translations,
      isVeg: d.isVeg,
      isAvailable: d.isAvailable,
      isSpecialOfDay: d.isSpecialOfDay,
      isChefSpecial: formData.get("isChefSpecial") === "true",
      availableFrom: d.availableFrom || null,
      availableTo: d.availableTo || null,
    },
  });
  revalidateMenu();
  return { ok: true };
}
