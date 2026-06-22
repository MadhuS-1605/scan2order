// Shared, framework-free cart helpers and menu types used across the diner
// ordering funnel (/menu, /cart, /checkout). The cart only stores
// {itemId, qty, optionIds}; names and prices are resolved from the menu items
// (keyed by id) at render time, so these helpers take the item map as input.

type Translations = Record<string, { name?: string }> | null;
export type ModOption = {
  id: string;
  name: string;
  priceDelta: number;
  translations?: Translations;
};
export type ModGroup = {
  id: string;
  name: string;
  required: boolean;
  minSelect: number;
  maxSelect: number;
  translations?: Translations;
  options: ModOption[];
};
export type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  categoryId: string | null;
  isVeg: boolean;
  isVegan: boolean;
  isJain: boolean;
  isSpicy: boolean;
  isGlutenFree: boolean;
  isSpecialOfDay: boolean;
  isChefSpecial: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  // Whether the item's time window includes "now" (venue tz). Items outside it
  // are shown but disabled, so diners see what's on the menu and when.
  availableNow: boolean;
  imageUrl: string | null;
  translations: Record<string, { name?: string; description?: string }> | null;
  modifierGroups: ModGroup[];
};

export type CartLine = {
  itemId: string;
  qty: number;
  optionIds: string[];
  notes?: string; // diner's per-item special instruction
};
export type Cart = Record<string, CartLine>;

// A stable key per (item + chosen options) so the same dish with different
// modifiers occupies distinct cart lines.
export function lineKey(itemId: string, optionIds: string[]): string {
  return itemId + "|" + [...optionIds].sort().join(",");
}

// Unit price for an item with the given options, including happy-hour factor.
export function optionPrice(
  item: Item,
  optionIds: string[],
  hhFactor: number,
): number {
  let extra = 0;
  for (const g of item.modifierGroups)
    for (const o of g.options)
      if (optionIds.includes(o.id)) extra += o.priceDelta;
  return Math.round((item.price + extra) * hhFactor * 100) / 100;
}

// Human-readable labels for the chosen options (e.g. "Large · Extra cheese").
export function optionLabels(item: Item, optionIds: string[]): string[] {
  return item.modifierGroups
    .flatMap((g) => g.options)
    .filter((o) => optionIds.includes(o.id))
    .map((o) => o.name);
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((s, l) => s + l.qty, 0);
}

export function cartSubtotal(
  cart: Cart,
  byId: Map<string, Item>,
  hhFactor: number,
): number {
  return Object.values(cart).reduce((s, l) => {
    const it = byId.get(l.itemId);
    return it ? s + optionPrice(it, l.optionIds, hhFactor) * l.qty : s;
  }, 0);
}
