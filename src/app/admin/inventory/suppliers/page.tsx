import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { toNumber, formatMoney } from "@/lib/utils";
import { Card, Input, Button, Select } from "@/components/ui";
import {
  createSupplierAction,
  deleteSupplierAction,
  addPurchaseOrderLineAction,
  receivePurchaseOrderAction,
  deletePurchaseOrderAction,
} from "@/lib/inventory/supplier-actions";

export default async function SuppliersPage() {
  const { restaurant, config } = await getCurrentRestaurant("menu");
  const cur = config.currency;

  const [suppliers, ingredients, purchaseOrders] = await Promise.all([
    prisma.supplier.findMany({ where: { restaurantId: restaurant.id }, orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ where: { restaurantId: restaurant.id }, orderBy: { name: "asc" } }),
    prisma.purchaseOrder.findMany({
      where: { restaurantId: restaurant.id },
      include: { supplier: true, lines: { include: { ingredient: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/inventory/recipes" className="text-sm text-ink/45 hover:text-ink">
          ← Recipes & ingredients
        </Link>
        <h1 className="font-display text-3xl font-medium text-ink">Suppliers & purchase orders</h1>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Suppliers</h2>
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-ink">{s.name}</p>
                  <p className="text-xs text-ink/45">{[s.phone, s.email].filter(Boolean).join(" · ")}</p>
                </div>
                <form action={deleteSupplierAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <Button size="sm" variant="ghost" type="submit">
                    Delete
                  </Button>
                </form>
              </li>
            ))}
            {suppliers.length === 0 && (
              <li className="p-4 text-sm text-ink/45">No suppliers yet.</li>
            )}
          </ul>
        </Card>
        <Card>
          <form action={createSupplierAction} className="flex flex-wrap items-end gap-2">
            <Input name="name" placeholder="Supplier name" required className="w-44" />
            <Input name="phone" placeholder="Phone" className="w-36" />
            <Input name="email" placeholder="Email" className="w-48" />
            <Button type="submit">Add supplier</Button>
          </form>
        </Card>
      </section>

      {suppliers.length > 0 && ingredients.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl text-ink">Add to a purchase order</h2>
          <p className="text-sm text-ink/45">
            Adds a line to the supplier&apos;s open draft order (creates one if none exists).
          </p>
          <Card>
            <form action={addPurchaseOrderLineAction} className="flex flex-wrap items-end gap-2">
              <Select name="supplierId" className="w-40" required>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select name="ingredientId" className="w-40" required>
                {ingredients.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              <Input name="qty" type="number" min="0" step="0.01" placeholder="Qty" className="w-24" required />
              <Input name="unitCost" type="number" min="0" step="0.01" placeholder={`Cost/unit (${cur})`} className="w-32" />
              <Button type="submit">Add line</Button>
            </form>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Purchase orders</h2>
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {purchaseOrders.map((po) => {
              const total = po.lines.reduce((s, l) => s + toNumber(l.qty) * toNumber(l.unitCost), 0);
              return (
                <li key={po.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">
                      {po.supplier.name} · {formatMoney(total, cur)}
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                          po.status === "RECEIVED"
                            ? "bg-olive-500/15 text-olive-700"
                            : "bg-sand-200 text-ink/60"
                        }`}
                      >
                        {po.status}
                      </span>
                    </p>
                    <div className="flex gap-2">
                      {po.status !== "RECEIVED" && (
                        <>
                          <form action={receivePurchaseOrderAction}>
                            <input type="hidden" name="id" value={po.id} />
                            <Button size="sm" type="submit">
                              Mark received
                            </Button>
                          </form>
                          <form action={deletePurchaseOrderAction}>
                            <input type="hidden" name="id" value={po.id} />
                            <Button size="sm" variant="ghost" type="submit">
                              Delete
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                  <ul className="text-sm text-ink/60">
                    {po.lines.map((l) => (
                      <li key={l.id}>
                        {toNumber(l.qty)} {l.ingredient.unit} {l.ingredient.name} @ {formatMoney(toNumber(l.unitCost), cur)}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
            {purchaseOrders.length === 0 && (
              <li className="p-4 text-sm text-ink/45">No purchase orders yet.</li>
            )}
          </ul>
        </Card>
      </section>
    </div>
  );
}
