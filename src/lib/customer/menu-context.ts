import { prisma } from "@/lib/db";
import {
  isWithinWindow,
  toNumber,
  happyHourPercentNow,
  venueOrderingOpen,
} from "@/lib/utils";
import { subscriptionState } from "@/lib/subscription";
import { planLimits } from "@/lib/plans";
import { parseLanguages } from "@/lib/languages";
import { getActiveTableToken } from "@/lib/table-session";
import { flagEnabled } from "@/lib/platform/flags";
import type { Item } from "@/lib/customer/cart";

export type MenuContext = {
  qrToken: string;
  restaurantId: string;
  restaurant: { name: string; currency: string; groupName: string | null; logoUrl: string | null };
  table: { label: string; kind: string };
  config: {
    paymentTiming: string;
    onlinePaymentEnabled: boolean;
    counterPaymentEnabled: boolean;
    requireDinerLocation: boolean;
    serviceModel: string;
    requirePrepayment: boolean;
    minOrderAmount: number;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
  };
  happyHourPercent: number;
  // Whether the venue is currently accepting orders (business hours + manual
  // pause + platform suspension). When closed, the diner can browse but not order.
  ordering: { open: boolean; reason: "paused" | "closed" | "suspended" | "maintenance" | null };
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
          categories: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
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
  // Effective plan (a lapsed paid plan falls back to Free) → whether online
  // payment is allowed right now.
  const planOnline = planLimits(
    subscriptionState({
      planTier: restaurant.planTier,
      planActiveUntil: restaurant.planActiveUntil,
      planIsTrial: restaurant.planIsTrial,
    }).effectiveTier,
  ).onlinePayments;

  const tz = config.timezone;
  // Categories are already pre-filtered to isActive above — a hidden category's
  // items shouldn't surface either, but an uncategorised item (categoryId null)
  // always stays visible.
  const activeCategoryIds = new Set(restaurant.categories.map((c) => c.id));
  // Show items even when outside their time window — the diner sees what's on
  // the menu and when it's available (the row renders disabled). Only manually
  // unavailable, out-of-stock, or hidden-category items are hidden.
  const shown = restaurant.menuItems.filter(
    (i) =>
      i.isAvailable &&
      !(i.trackStock && i.stockQty <= 0) &&
      (i.categoryId === null || activeCategoryIds.has(i.categoryId)),
  );

  const happyHourPercent = happyHourPercentNow(
    {
      enabled: config.happyHourEnabled,
      from: config.happyHourFrom,
      to: config.happyHourTo,
      percent: toNumber(config.happyHourPercent),
    },
    tz,
  );

  const items: Item[] = shown.map((i) => ({
    id: i.id,
    name: i.name,
    description: i.description,
    price: toNumber(i.price),
    categoryId: i.categoryId,
    isVeg: i.isVeg,
    isVegan: i.isVegan,
    isJain: i.isJain,
    isSpicy: i.isSpicy,
    isGlutenFree: i.isGlutenFree,
    isSpecialOfDay: i.isSpecialOfDay,
    isChefSpecial: i.isChefSpecial,
    availableFrom: i.availableFrom,
    availableTo: i.availableTo,
    availableNow: isWithinWindow(i.availableFrom, i.availableTo, tz),
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
        translations: g.translations as Record<string, { name?: string }> | null,
        options: g.options.map((o) => ({
          id: o.id,
          name: o.name,
          priceDelta: toNumber(o.priceDelta),
          translations: o.translations as Record<string, { name?: string }> | null,
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
      logoUrl: restaurant.logoUrl,
    },
    table: { label: table.label, kind: table.kind },
    config: {
      paymentTiming: config.paymentTiming,
      // Real-time plan gate: online payment only when the active plan allows it
      // (a lapsed paid plan / Free tier can't take online payments), regardless
      // of the stored flag.
      onlinePaymentEnabled: config.onlinePaymentEnabled && planOnline,
      counterPaymentEnabled: config.counterPaymentEnabled,
      requireDinerLocation: config.requireDinerLocation,
      serviceModel: config.serviceModel,
      requirePrepayment: config.requirePrepayment,
      minOrderAmount: config.minOrderAmount,
      pickupEnabled: config.pickupEnabled,
      deliveryEnabled: config.deliveryEnabled,
    },
    happyHourPercent,
    // Ordering availability: a platform suspension or the global maintenance
    // kill switch both block ordering (diners may still browse); otherwise the
    // venue's own pause + business hours apply.
    ordering:
      restaurant.status === "SUSPENDED"
        ? { open: false, reason: "suspended" as const }
        : !(await flagEnabled("ordering_enabled"))
          ? { open: false, reason: "maintenance" as const }
          : venueOrderingOpen({
              orderingPaused: config.orderingPaused,
              openTime: config.openTime,
              closeTime: config.closeTime,
              timezone: config.timezone,
            }),
    languages: parseLanguages(config.languages),
    categories: restaurant.categories.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
    })),
    items,
  };
}
