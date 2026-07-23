import { Sparkles } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { parseLanguages } from "@/lib/languages";
import { MENU_TEMPLATES } from "@/lib/templates";
import { applyTemplateAction } from "@/lib/platform/actions";
import { getBaseUrl } from "@/lib/request";
import { tableOrderUrl } from "@/lib/qr";
import { Card } from "@/components/ui";
import { MenuManager } from "./menu-manager";

export default async function MenuPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("menu");
  const languages = parseLanguages(restaurant.config!.languages);

  const [categories, items, previewTable] = await Promise.all([
    prisma.menuCategory.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: { options: { orderBy: { sortOrder: "asc" } } },
        },
        comboLines: {
          orderBy: { sortOrder: "asc" },
          include: { includedItem: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.restaurantTable.findFirst({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { createdAt: "asc" },
      select: { qrToken: true },
    }),
  ]);
  const previewUrl = previewTable
    ? tableOrderUrl(previewTable.qrToken, await getBaseUrl())
    : null;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">{t(d, "menu.title")}</h1>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-medium text-ink">
              <Sparkles className="h-4 w-4 text-brand-600" /> {t(d, "menu.starterMenus")}
            </h2>
            <p className="mt-0.5 text-xs text-ink/55">
              {t(d, "menu.starterMenusHint")}
            </p>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {MENU_TEMPLATES.map((t) => (
            <form key={t.key} action={applyTemplateAction}>
              <input type="hidden" name="template" value={t.key} />
              <button
                type="submit"
                className="w-full rounded-lg border border-sand-300 bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-sand-100"
              >
                <span className="block text-sm font-medium text-ink">{t.name}</span>
                <span className="block text-xs text-ink/50">{t.blurb}</span>
              </button>
            </form>
          ))}
        </div>
      </Card>

      <MenuManager
        currency={restaurant.config!.currency}
        languages={languages}
        categories={categories.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }))}
        previewUrl={previewUrl}
        items={items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          price: i.price.toString(),
          categoryId: i.categoryId,
          isVeg: i.isVeg,
          isVegan: i.isVegan,
          isJain: i.isJain,
          isSpicy: i.isSpicy,
          isGlutenFree: i.isGlutenFree,
          isAvailable: i.isAvailable,
          isSpecialOfDay: i.isSpecialOfDay,
          isChefSpecial: i.isChefSpecial,
          isCombo: i.isCombo,
          comboLines: i.comboLines.map((l) => ({
            id: l.id,
            includedItemId: l.includedItemId,
            includedItemName: l.includedItem.name,
            quantity: l.quantity,
          })),
          availableFrom: i.availableFrom,
          availableTo: i.availableTo,
          imageUrl: i.imageUrl,
          translations: (i.translations as Record<
            string,
            { name?: string; description?: string }
          > | null) ?? {},
          modifierGroups: i.modifierGroups.map((g) => ({
            id: g.id,
            name: g.name,
            required: g.required,
            maxSelect: g.maxSelect,
            options: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              priceDelta: o.priceDelta.toString(),
            })),
          })),
        }))}
      />
    </div>
  );
}
