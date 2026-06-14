"use client";

import { setStockAction, restockAction } from "@/lib/inventory/actions";
import { Button, Input, Card } from "@/components/ui";

type Item = {
  id: string;
  name: string;
  trackStock: boolean;
  stockQty: number;
  lowStockThreshold: number;
};

export function InventoryManager({ items }: { items: Item[] }) {
  if (items.length === 0)
    return <p className="text-sm text-ink/45">No menu items yet.</p>;

  return (
    <Card className="p-0">
      <ul className="divide-y divide-sand-100">
        {items.map((it) => {
          const out = it.trackStock && it.stockQty <= 0;
          const low =
            it.trackStock && !out && it.stockQty <= it.lowStockThreshold;
          return (
            <li
              key={it.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-ink">{it.name}</span>
                {it.trackStock ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      out
                        ? "bg-red-100 text-red-700"
                        : low
                          ? "bg-brand-100 text-brand-700"
                          : "bg-olive-500/15 text-olive-600"
                    }`}
                  >
                    {out ? "Out of stock" : `${it.stockQty} in stock`}
                  </span>
                ) : (
                  <span className="text-xs text-ink/40">Not tracked</span>
                )}
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {it.trackStock && (
                  <>
                    {[10, 50].map((n) => (
                      <form key={n} action={restockAction}>
                        <input type="hidden" name="id" value={it.id} />
                        <input type="hidden" name="amount" value={n} />
                        <Button size="sm" variant="secondary" type="submit">
                          +{n}
                        </Button>
                      </form>
                    ))}
                  </>
                )}
                <form
                  action={setStockAction}
                  className="flex items-end gap-2 rounded-lg border border-sand-200 bg-sand-100/40 p-2"
                >
                  <input type="hidden" name="id" value={it.id} />
                  <label className="flex items-center gap-1.5 text-xs text-ink/70">
                    <input
                      type="checkbox"
                      name="trackStock"
                      defaultChecked={it.trackStock}
                    />
                    Track
                  </label>
                  <div>
                    <label className="block text-[10px] uppercase text-ink/45">
                      Qty
                    </label>
                    <Input
                      name="stockQty"
                      type="number"
                      min="0"
                      defaultValue={it.stockQty}
                      className="w-20"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase text-ink/45">
                      Low at
                    </label>
                    <Input
                      name="lowStockThreshold"
                      type="number"
                      min="0"
                      defaultValue={it.lowStockThreshold}
                      className="w-20"
                    />
                  </div>
                  <Button size="sm" type="submit">
                    Save
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
