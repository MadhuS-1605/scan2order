import { describe, it, expect } from "vitest";
import {
  type Item,
  lineKey,
  optionPrice,
  optionLabels,
  cartSubtotal,
  cartCount,
  type Cart,
} from "@/lib/customer/cart";

function item(over: Partial<Item> = {}): Item {
  return {
    id: "i1",
    name: "Paneer Tikka",
    description: null,
    price: 100,
    categoryId: null,
    isVeg: true,
    isSpecialOfDay: false,
    isChefSpecial: false,
    availableFrom: null,
    availableTo: null,
    imageUrl: null,
    translations: null,
    modifierGroups: [
      {
        id: "g1",
        name: "Size",
        required: true,
        minSelect: 1,
        maxSelect: 1,
        options: [
          { id: "o1", name: "Half", priceDelta: 0 },
          { id: "o2", name: "Full", priceDelta: 20 },
        ],
      },
    ],
    ...over,
  };
}

describe("lineKey", () => {
  it("is option-order independent", () => {
    expect(lineKey("i1", ["a", "b"])).toBe(lineKey("i1", ["b", "a"]));
  });
  it("differs by item and by options", () => {
    expect(lineKey("i1", [])).not.toBe(lineKey("i2", []));
    expect(lineKey("i1", ["o2"])).not.toBe(lineKey("i1", []));
  });
});

describe("optionPrice", () => {
  it("is base when no options", () => {
    expect(optionPrice(item(), [], 1)).toBe(100);
  });
  it("adds option deltas", () => {
    expect(optionPrice(item(), ["o2"], 1)).toBe(120);
  });
  it("applies happy-hour factor and rounds", () => {
    expect(optionPrice(item(), ["o2"], 0.5)).toBe(60);
  });
});

describe("optionLabels", () => {
  it("returns the chosen option names", () => {
    expect(optionLabels(item(), ["o2"])).toEqual(["Full"]);
    expect(optionLabels(item(), [])).toEqual([]);
  });
});

describe("cartSubtotal & cartCount", () => {
  const byId = new Map<string, Item>([["i1", item()]]);
  const cart: Cart = {
    [lineKey("i1", [])]: { itemId: "i1", qty: 2, optionIds: [] },
    [lineKey("i1", ["o2"])]: { itemId: "i1", qty: 1, optionIds: ["o2"] },
  };
  it("sums qty * unit price across lines", () => {
    // 2*100 + 1*120 = 320
    expect(cartSubtotal(cart, byId, 1)).toBe(320);
  });
  it("counts total quantity", () => {
    expect(cartCount(cart)).toBe(3);
  });
  it("ignores lines whose item is missing", () => {
    expect(cartSubtotal(cart, new Map(), 1)).toBe(0);
  });
});
