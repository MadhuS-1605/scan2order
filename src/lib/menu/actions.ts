"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { menuItemSchema, type ActionState } from "@/lib/validation";
import { parseCsv } from "@/lib/csv";
import { menuItemQuotaReached } from "@/lib/plan-limits";
import { round2 } from "@/lib/pricing";
import { toNumber } from "@/lib/utils";

const truthy = new Set(["1", "true", "yes", "y", "veg"]);

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

export async function toggleCategoryActiveAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const category = await prisma.menuCategory.findFirst({
    where: { id, restaurantId },
  });
  if (!category) return;
  await prisma.menuCategory.updateMany({
    where: { id, restaurantId },
    data: { isActive: !category.isActive },
  });
  revalidateMenu();
}

// Enable/disable or percentage-adjust the price of several items at once —
// scoped to this tenant's own items regardless of which ids were posted.
export async function bulkUpdateItemsAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const op = String(formData.get("op"));
  if (ids.length === 0) return;
  const where = { id: { in: ids }, restaurantId };

  if (op === "enable") {
    await prisma.menuItem.updateMany({ where, data: { isAvailable: true } });
  } else if (op === "disable") {
    await prisma.menuItem.updateMany({ where, data: { isAvailable: false } });
  } else if (op === "priceAdjust") {
    const pct = Number(formData.get("pct")) || 0;
    const targets = await prisma.menuItem.findMany({ where, select: { id: true, price: true } });
    await prisma.$transaction(
      targets.map((it) =>
        prisma.menuItem.update({
          where: { id: it.id },
          data: { price: round2(Math.max(0, toNumber(it.price) * (1 + pct / 100))) },
        }),
      ),
    );
  }
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

// Move an item up/down within its category. Normalises the whole category's
// sortOrder to its current display order, then swaps the two neighbours — so it
// works even when items still have the default sortOrder 0.
export async function moveItemAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const item = await prisma.menuItem.findFirst({ where: { id, restaurantId }, select: { id: true, categoryId: true } });
  if (!item) return;
  const sibs = await prisma.menuItem.findMany({
    where: { restaurantId, categoryId: item.categoryId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const order = sibs.map((s) => s.id);
  const idx = order.indexOf(id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= order.length) return;
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await prisma.$transaction(order.map((oid, i) => prisma.menuItem.update({ where: { id: oid }, data: { sortOrder: i } })));
  revalidateMenu();
}

export async function moveCategoryAction(formData: FormData): Promise<void> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  const dir = String(formData.get("dir")) === "up" ? -1 : 1;
  const cats = await prisma.menuCategory.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const order = cats.map((c) => c.id);
  const idx = order.indexOf(id);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= order.length) return;
  [order[idx], order[swap]] = [order[swap], order[idx]];
  await prisma.$transaction(order.map((cid, i) => prisma.menuCategory.update({ where: { id: cid }, data: { sortOrder: i } })));
  revalidateMenu();
}

// Bulk-import menu items from pasted CSV. Header row maps columns by name
// (name, price, category, description, veg). Creates missing categories, appends
// items in order, and respects the plan's item quota.
export async function importMenuCsvAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { restaurantId } = await requireAdminWithPermission("menu");
  const rows = parseCsv(String(formData.get("csv") ?? ""));
  if (rows.length < 2) return { error: "Paste CSV with a header row and at least one item." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const ciName = col("name");
  const ciPrice = col("price");
  const ciCat = col("category");
  const ciDesc = col("description");
  const ciVeg = col("veg");
  if (ciName < 0 || ciPrice < 0) return { error: 'CSV must have "name" and "price" columns.' };

  // Existing categories by lowercased name.
  const cats = await prisma.menuCategory.findMany({ where: { restaurantId }, select: { id: true, name: true } });
  const catByName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
  let catCount = cats.length;
  const itemCountByCat = new Map<string | null, number>();

  let created = 0;
  let skipped = 0;
  for (const r of rows.slice(1, 501)) {
    const name = (r[ciName] ?? "").trim();
    const price = Number((r[ciPrice] ?? "").trim());
    if (!name || !Number.isFinite(price) || price < 0) { skipped++; continue; }
    if (await menuItemQuotaReached(restaurantId)) {
      return { error: `Reached your plan's item limit after importing ${created}. Upgrade to add more.` };
    }
    // Resolve / create category.
    let categoryId: string | null = null;
    const catName = ciCat >= 0 ? (r[ciCat] ?? "").trim() : "";
    if (catName) {
      const key = catName.toLowerCase();
      categoryId = catByName.get(key) ?? null;
      if (!categoryId) {
        const c = await prisma.menuCategory.create({ data: { restaurantId, name: catName, sortOrder: catCount++ } });
        categoryId = c.id;
        catByName.set(key, c.id);
      }
    }
    // Append within its category.
    let pos = itemCountByCat.get(categoryId);
    if (pos === undefined) {
      pos = await prisma.menuItem.count({ where: { restaurantId, categoryId } });
    }
    itemCountByCat.set(categoryId, pos + 1);
    await prisma.menuItem.create({
      data: {
        restaurantId,
        categoryId,
        name: name.slice(0, 120),
        description: ciDesc >= 0 ? (r[ciDesc] ?? "").trim().slice(0, 500) || null : null,
        price,
        isVeg: ciVeg >= 0 ? truthy.has((r[ciVeg] ?? "").trim().toLowerCase()) : true,
        sortOrder: pos,
      },
    });
    created++;
  }
  revalidateMenu();
  return { ok: true, message: `Imported ${created} item${created === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}.` };
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
    isVegan: formData.get("isVegan") === "true",
    isJain: formData.get("isJain") === "true",
    isSpicy: formData.get("isSpicy") === "true",
    isGlutenFree: formData.get("isGlutenFree") === "true",
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

  // Never trust a client-supplied categoryId — it must belong to this tenant.
  const categoryId = d.categoryId
    ? (await prisma.menuCategory.findFirst({ where: { id: d.categoryId, restaurantId }, select: { id: true } }))?.id ?? null
    : null;

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
      categoryId,
      imageUrl: d.imageUrl || null,
      translations,
      isVeg: d.isVeg,
      isVegan: d.isVegan ?? false,
      isJain: d.isJain ?? false,
      isSpicy: d.isSpicy ?? false,
      isGlutenFree: d.isGlutenFree ?? false,
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
