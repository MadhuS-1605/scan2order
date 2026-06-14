import { prisma } from "@/lib/db";
import { isWithinWindow, toNumber, happyHourPercentNow } from "@/lib/utils";
import { parseLanguages } from "@/lib/languages";
import { getActiveTableToken } from "@/lib/table-session";
import type { Item } from "@/lib/customer/cart";

export type MenuContext = {
  qrToken: string;
  restaurantId: string;
  restaurant: { name: string; currency: string; groupName: string | null };
  table: { label: string; kind: string };
  config: {
    paymentTiming: string;
    onlinePaymentEnabled: boolean;
    counterPaymentEnabled: boolean;
    requireDinerLocation: boolean;
  };
  happyHourPercent: number;
  languages: string[];
  categories: { id: string; name: string; icon: string | null }[];
  items: Item[];
};

// Loads everything the diner ordering funnel needs for the active table:
// menu items (filtered to what's currently available), categories, currency,
// happy-hour pricing and payment config. Shared by /menu, /cart and /checkout
// so they price and render the cart identically. Returns null when there's no
// valid active table (caller should show the scan prompt).
export async function getMenuContext(): Promise<MenuContext | null> {
  const qrToken = await getActiveTableToken();
  if (!qrToken) return null;

  const table = await prisma.restaurantTable.findUnique({
    where: { qrToken },
    include: {
      restaurant: {
        include: {
          config: true,
          group: { select: { name: true } },
          categories: { orderBy: { sortOrder: "asc" } },
          menuItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              modifierGroups: {
                orderBy: { sortOrder: "asc" },
                include: {
                  options: {
                    where: { isAvailable: true },
                    orderBy: { sortOrder: "asc" },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!table || !table.isActive || !table.restaurant.config) return null;
  const { restaurant } = table;
  const config = restaurant.config!;

  const now = new Date();
  const available = restaurant.menuItems.filter(
    (i) =>
      i.isAvailable &&
      isWithinWindow(i.availableFrom, i.availableTo, now) &&
      !(i.trackStock && i.stockQty <= 0),
  );

  const happyHourPercent = happyHourPercentNow(
    {
      enabled: config.happyHourEnabled,
      from: config.happyHourFrom,
      to: config.happyHourTo,
      percent: toNumber(config.happyHourPercent),
    },
    now,
  );

  const items: Item[] = available.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    price: toNumber(i.price),
    categoryId: i.categoryId,
    isVeg: i.isVeg,
    isSpecialOfDay: i.isSpecialOfDay,
    isChefSpecial: i.isChefSpecial,
    availableFrom: i.availableFrom,
    availableTo: i.availableTo,
    imageUrl: i.imageUrl,
    translations: i.translations as Record<
      string,
      { name?: string; description?: string }
    > | null,
    modifierGroups: i.modifierGroups
      .filter((g) => g.options.length > 0)
      .map((g) => ({
        id: g.id,
        name: g.name,
        required: g.required,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: toNumber(o.priceDelta),
        })),
      })),
  }));

  return {
    qrToken,
    restaurantId: restaurant.id,
    restaurant: {
      name: restaurant.name,
      currency: config.currency,
      groupName: restaurant.group?.name ?? null,
    },
    table: { label: table.label, kind: table.kind },
    config: {
      paymentTiming: config.paymentTiming,
      onlinePaymentEnabled: config.onlinePaymentEnabled,
      counterPaymentEnabled: config.counterPaymentEnabled,
      requireDinerLocation: config.requireDinerLocation,
    },
    happyHourPercent,
    languages: parseLanguages(config.languages),
    categories: restaurant.categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
    })),
    items,
  };
}
