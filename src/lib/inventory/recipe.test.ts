import { describe, it, expect } from "vitest";
import { aggregateRecipeConsumption } from "./recipe";

describe("aggregateRecipeConsumption", () => {
  it("sums ingredient usage across multiple lines of the same dish", () => {
    const recipes = new Map([
      ["butter-chicken", [{ ingredientId: "chicken", qtyPerServing: 200 }, { ingredientId: "butter", qtyPerServing: 30 }]],
    ]);
    const out = aggregateRecipeConsumption(
      [{ menuItemId: "butter-chicken", quantity: 3 }],
      recipes,
    );
    expect(out.get("chicken")).toBe(600);
    expect(out.get("butter")).toBe(90);
  });

  it("combines shared ingredients across different dishes", () => {
    const recipes = new Map([
      ["naan", [{ ingredientId: "flour", qtyPerServing: 100 }]],
      ["roti", [{ ingredientId: "flour", qtyPerServing: 60 }]],
    ]);
    const out = aggregateRecipeConsumption(
      [
        { menuItemId: "naan", quantity: 2 },
        { menuItemId: "roti", quantity: 1 },
      ],
      recipes,
    );
    expect(out.get("flour")).toBe(260);
  });

  it("ignores menu items with no recipe", () => {
    const out = aggregateRecipeConsumption(
      [{ menuItemId: "unmapped", quantity: 5 }],
      new Map(),
    );
    expect(out.size).toBe(0);
  });
});
