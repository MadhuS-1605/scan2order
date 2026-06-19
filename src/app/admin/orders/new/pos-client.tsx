"use client";

import { useMemo, useState } from "react";
import { Plus, Minus, Search } from "lucide-react";
import { createStaffOrderAction } from "@/lib/orders/staff-actions";
import { Button, Input, VegMark } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { useT } from "@/components/admin/i18n-provider";

type Item = { id: string; name: string; price: number; categoryId: string | null; isVeg: boolean };

export function PosClient({
  currency,
  tables,
  categories,
  items,
}: {
  currency: string;
  tables: { id: string; label: string }[];
  categories: { id: string; name: string }[];
  items: Item[];
}) {
  const tr = useT();
  const [tableId, setTableId] = useState(tables[0]?.id ?? "");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [q, setQ] = useState("");

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const filtered = q
    ? items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    : items;
  const grouped = categories
    .map((c) => ({ c, items: filtered.filter((i) => i.categoryId === c.id) }))
    .filter((g) => g.items.length > 0);
  const uncategorised = filtered.filter((i) => !i.categoryId);

  const setQty = (id: string, qty: number) =>
    setCart((c) => {
      const next = { ...c };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const lines = Object.entries(cart);
  const count = lines.reduce((s, [, q]) => s + q, 0);
  const subtotal = lines.reduce((s, [id, q]) => s + (byId.get(id)?.price ?? 0) * q, 0);
  const itemsJson = JSON.stringify(
    lines.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
  );

  const renderRow = (i: Item) => {
    const qty = cart[i.id] ?? 0;
    return (
      <div
        key={i.id}
        className="flex items-center justify-between gap-3 rounded-lg border border-sand-200 bg-surface px-3 py-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <VegMark isVeg={i.isVeg} />
          <span className="truncate text-sm text-ink">{i.name}</span>
          <span className="shrink-0 text-xs text-ink/45">{formatMoney(i.price, currency)}</span>
        </span>
        {qty === 0 ? (
          <Button size="sm" variant="secondary" onClick={() => setQty(i.id, 1)}>
            {tr("common.add")}
          </Button>
        ) : (
          <span className="flex items-center gap-2 rounded-lg border border-sand-300">
            <button className="px-2 py-1 text-ink/70" onClick={() => setQty(i.id, qty - 1)} aria-label={tr("pos.decrease")}>
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-sm font-medium">{qty}</span>
            <button className="px-2 py-1 text-ink/70" onClick={() => setQty(i.id, qty + 1)} aria-label={tr("pos.increase")}>
              <Plus className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      {/* Menu */}
      <div className="space-y-4">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink/35">
            <Search className="h-4 w-4" />
          </span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("pos.searchMenu")}
            className="pl-10"
          />
        </div>
        {grouped.map((g) => (
          <div key={g.c.id}>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink/45">{g.c.name}</p>
            <div className="space-y-1.5">{g.items.map((i) => renderRow(i))}</div>
          </div>
        ))}
        {uncategorised.length > 0 && (
          <div className="space-y-1.5">{uncategorised.map((i) => renderRow(i))}</div>
        )}
      </div>

      {/* Ticket */}
      <form
        action={createStaffOrderAction}
        className="h-fit space-y-3 rounded-2xl border border-sand-200 bg-surface p-4 lg:sticky lg:top-6"
      >
        <input type="hidden" name="items" value={itemsJson} />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink/60">{tr("pos.table")}</label>
          <select
            name="tableId"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            required
            className="w-full rounded-lg border border-sand-300 bg-surface px-3 py-2 text-sm"
          >
            {tables.length === 0 && <option value="">{tr("pos.noTables")}</option>}
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {count === 0 ? (
          <p className="py-4 text-center text-sm text-ink/45">{tr("pos.addItemsHint")}</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto border-y border-sand-100 py-2 text-sm">
            {lines.map(([id, qty]) => {
              const i = byId.get(id);
              if (!i) return null;
              return (
                <li key={id} className="flex justify-between">
                  <span className="text-ink/80">
                    {qty}× {i.name}
                  </span>
                  <span className="text-ink/60">{formatMoney(i.price * qty, currency)}</span>
                </li>
              );
            })}
          </ul>
        )}

        <Input value={name} onChange={(e) => setName(e.target.value)} name="customerName" placeholder={tr("pos.guestName")} />
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} name="notes" placeholder={tr("pos.kitchenNotes")} />

        <div className="flex items-center justify-between border-t border-sand-100 pt-2 text-sm">
          <span className="text-ink/55">{tr("pos.subtotal")}</span>
          <span className="font-display text-lg text-ink">{formatMoney(subtotal, currency)}</span>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={count === 0 || !tableId}>
          {tr("pos.placeOrder")} · {count}{" "}
          {count === 1 ? tr("pos.item") : tr("pos.items")}
        </Button>
        <p className="text-center text-[11px] text-ink/40">{tr("pos.taxesNote")}</p>
      </form>
    </div>
  );
}
