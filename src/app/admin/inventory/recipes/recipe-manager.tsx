import {
  createIngredientAction,
  restockIngredientAction,
  setIngredientThresholdAction,
  deleteIngredientAction,
  setRecipeLineAction,
  deleteRecipeLineAction,
  recordWastageAction,
} from "@/lib/inventory/recipe-actions";
import { Button, Input, Select, Card } from "@/components/ui";

type Ingredient = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  lowStockThreshold: number;
  costPerUnit: number;
};

type MenuItemWithRecipe = {
  id: string;
  name: string;
  recipeLines: { id: string; ingredientId: string; qtyPerServing: number }[];
};

export function RecipeManager({
  ingredients,
  menuItems,
}: {
  ingredients: Ingredient[];
  menuItems: MenuItemWithRecipe[];
}) {
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Ingredients</h2>
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {ingredients.length === 0 && (
              <li className="p-4 text-sm text-ink/45">No ingredients yet — add your first raw material below.</li>
            )}
            {ingredients.map((ing) => {
              const out = ing.stockQty <= 0;
              const low = !out && ing.stockQty <= ing.lowStockThreshold;
              return (
                <li key={ing.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-ink">{ing.name}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        out
                          ? "bg-red-100 text-red-700"
                          : low
                            ? "bg-brand-100 text-brand-700"
                            : "bg-olive-500/15 text-olive-600"
                      }`}
                    >
                      {ing.stockQty} {ing.unit}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    {[10, 50].map((n) => (
                      <form key={n} action={restockIngredientAction}>
                        <input type="hidden" name="id" value={ing.id} />
                        <input type="hidden" name="amount" value={n} />
                        <Button size="sm" variant="secondary" type="submit">
                          +{n} {ing.unit}
                        </Button>
                      </form>
                    ))}
                    <form
                      action={setIngredientThresholdAction}
                      className="flex items-end gap-2 rounded-lg border border-sand-200 bg-sand-100/40 p-2"
                    >
                      <input type="hidden" name="id" value={ing.id} />
                      <div>
                        <label className="block text-[10px] uppercase text-ink/45">Low at</label>
                        <Input
                          name="lowStockThreshold"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={ing.lowStockThreshold}
                          className="w-20"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] uppercase text-ink/45">Cost/unit</label>
                        <Input
                          name="costPerUnit"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={ing.costPerUnit}
                          className="w-20"
                        />
                      </div>
                      <Button size="sm" type="submit">
                        Save
                      </Button>
                    </form>
                    <form action={recordWastageAction} className="flex items-end gap-1">
                      <input type="hidden" name="id" value={ing.id} />
                      <div>
                        <label className="block text-[10px] uppercase text-ink/45">Waste</label>
                        <Input name="qty" type="number" min="0" step="0.01" placeholder="0" className="w-16" />
                      </div>
                      <Button size="sm" variant="secondary" type="submit">
                        Log
                      </Button>
                    </form>
                    <form action={deleteIngredientAction}>
                      <input type="hidden" name="id" value={ing.id} />
                      <Button size="sm" variant="ghost" type="submit">
                        Delete
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <form action={createIngredientAction} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] uppercase text-ink/45">Name</label>
              <Input name="name" placeholder="e.g. Paneer" required className="w-40" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-ink/45">Unit</label>
              <Input name="unit" placeholder="g, ml, pcs" required className="w-24" />
            </div>
            <div>
              <label className="block text-[10px] uppercase text-ink/45">Cost / unit (₹)</label>
              <Input name="costPerUnit" type="number" min="0" step="0.01" className="w-28" />
            </div>
            <Button type="submit">Add ingredient</Button>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Recipes</h2>
        <p className="text-sm text-ink/45">
          Attach ingredients to a dish with how much one serving uses. Leave qty at 0 to remove a line.
        </p>
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {menuItems.map((item) => (
              <li key={item.id} className="space-y-2 p-4">
                <p className="font-medium text-ink">{item.name}</p>
                {item.recipeLines.length > 0 && (
                  <ul className="space-y-1">
                    {item.recipeLines.map((line) => {
                      const ing = byId.get(line.ingredientId);
                      if (!ing) return null;
                      return (
                        <li key={line.id} className="flex items-center gap-2 text-sm text-ink/70">
                          <span className="flex-1">
                            {ing.name} — {line.qtyPerServing} {ing.unit} / serving
                          </span>
                          <form action={deleteRecipeLineAction}>
                            <input type="hidden" name="id" value={line.id} />
                            <Button size="sm" variant="ghost" type="submit">
                              Remove
                            </Button>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {ingredients.length > 0 && (
                  <form action={setRecipeLineAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="menuItemId" value={item.id} />
                    <Select name="ingredientId" className="w-40" required>
                      {ingredients.map((ing) => (
                        <option key={ing.id} value={ing.id}>
                          {ing.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      name="qtyPerServing"
                      type="number"
                      min="0"
                      step="0.001"
                      placeholder="Qty / serving"
                      className="w-28"
                    />
                    <Button size="sm" variant="secondary" type="submit">
                      Add / update
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
