// Ingredient consumption for a set of ordered menu-item lines, given each
// item's recipe (ingredientId + qtyPerServing). Pure so it's unit-testable
// without a DB — see src/lib/inventory/recipe.test.ts.
export function aggregateRecipeConsumption(
  lines: { menuItemId: string; quantity: number }[],
  recipesByItem: Map<string, { ingredientId: string; qtyPerServing: number }[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of lines) {
    const recipe = recipesByItem.get(l.menuItemId);
    if (!recipe) continue;
    for (const r of recipe) {
      out.set(r.ingredientId, (out.get(r.ingredientId) ?? 0) + r.qtyPerServing * l.quantity);
    }
  }
  return out;
}
