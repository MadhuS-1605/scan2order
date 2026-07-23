import { transferIngredientStockAction } from "@/lib/inventory/transfer-actions";
import { Button, Input, Select, Card } from "@/components/ui";

export function TransferStockForm({
  ingredients,
  outlets,
}: {
  ingredients: { id: string; name: string; unit: string }[];
  outlets: { id: string; name: string }[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl text-ink">Transfer stock to another outlet</h2>
      <Card>
        <form action={transferIngredientStockAction} className="flex flex-wrap items-end gap-2">
          <Select name="ingredientId" className="w-40" required>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </Select>
          <Input name="qty" type="number" min="0" step="0.01" placeholder="Qty" className="w-24" required />
          <Select name="toRestaurantId" className="w-48" required>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                → {o.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="secondary">
            Transfer
          </Button>
        </form>
      </Card>
    </section>
  );
}
