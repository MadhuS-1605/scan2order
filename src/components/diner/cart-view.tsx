"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { localize } from "@/lib/languages";
import { CustomerHeader, PoweredBy } from "@/components/customer-header";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import { Stepper } from "@/components/diner/controls";
import {
  type Item,
  cartSubtotal,
  optionLabels,
  optionPrice,
} from "@/lib/customer/cart";
import { useCart } from "@/lib/customer/use-cart";

export function CartView({
  restaurantId,
  happyHourPercent,
  restaurant,
  table,
  items,
}: {
  restaurantId: string;
  happyHourPercent: number;
  restaurant: { name: string; currency: string; groupName?: string | null; logoUrl?: string | null };
  table: { label: string; kind?: string };
  items: Item[];
}) {
  const hhFactor = happyHourPercent > 0 ? 1 - happyHourPercent / 100 : 1;
  const cur = restaurant.currency;
  const seat =
    table.kind === "ROOM"
      ? `Room ${table.label}`
      : table.kind === "COUNTER"
        ? "Pickup"
        : `Table ${table.label}`;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const { cart, ready, count, addLine, setNote } = useCart(restaurantId);

  const lines = Object.entries(cart);
  const subtotal = cartSubtotal(cart, byId, hhFactor);
  const empty = ready && count === 0;

  return (
    <div className="min-h-screen bg-grain pb-36">
      <CustomerHeader
        restaurantName={restaurant.name}
        groupName={restaurant.groupName}
        logoUrl={restaurant.logoUrl}
        seat={seat}
      />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 sm:py-8">
        <h1 className="font-display text-2xl text-ink">Your order</h1>

        {!ready ? (
          <p className="py-12 text-center text-sm text-ink/45">Loading your cart…</p>
        ) : empty ? (
          <div className="rounded-2xl border border-sand-200 bg-surface px-6 py-12 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-ink/20" />
            <p className="mt-3 text-sm text-ink/55">Your cart is empty.</p>
            <Link
              href="/menu"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Browse the menu
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-sand-100 rounded-2xl border border-sand-200 bg-surface px-4">
              {lines.map(([key, l]) => {
                const it = byId.get(l.itemId);
                if (!it) return null;
                const labels = optionLabels(it, l.optionIds);
                return (
                  <li key={key} className="flex items-start justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {localize(it, it.translations, "en").name}
                      </p>
                      {labels.length > 0 && (
                        <p className="text-xs text-ink/50">{labels.join(" · ")}</p>
                      )}
                      <p className="text-xs text-ink/55">
                        {formatMoney(optionPrice(it, l.optionIds, hhFactor), cur)}
                      </p>
                      <LineNote
                        note={l.notes ?? ""}
                        onChange={(v) => setNote(key, v)}
                      />
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-medium text-ink">
                        {formatMoney(
                          optionPrice(it, l.optionIds, hhFactor) * l.qty,
                          cur,
                        )}
                      </span>
                      <Stepper
                        qty={l.qty}
                        onChange={(nq) => addLine(l.itemId, l.optionIds, nq - l.qty)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-surface px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" />
              Add more items
            </Link>

            <div className="flex items-center justify-between border-t border-sand-100 pt-3">
              <span className="text-sm text-ink/55">Subtotal</span>
              <span className="font-display text-xl text-ink">
                {formatMoney(subtotal, cur)}
              </span>
            </div>
            <p className="text-xs text-ink/45">
              Taxes (if any) are calculated on your bill.
            </p>
          </>
        )}

        <PoweredBy />
      </div>

      {ready && count > 0 && (
        <div className="fixed inset-x-0 bottom-[52px] z-20 border-t border-sand-200 bg-surface p-3">
          <div className="mx-auto max-w-lg">
            <Link
              href="/checkout"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-center text-base font-medium text-white transition-all hover:bg-brand-700 active:translate-y-px"
            >
              Proceed to checkout · {formatMoney(subtotal, cur)}
            </Link>
          </div>
        </div>
      )}

      <CustomerTabBar />
    </div>
  );
}

// Per-item special instruction — a "+ Add a note" toggle that reveals an input.
function LineNote({
  note,
  onChange,
}: {
  note: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(note.length > 0);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-xs font-medium text-brand-600 hover:text-brand-700"
      >
        + Add a note
      </button>
    );
  }
  return (
    <input
      type="text"
      value={note}
      autoFocus
      maxLength={200}
      onChange={(e) => onChange(e.target.value)}
      placeholder="e.g. no onions, less spicy"
      className="mt-1 w-full rounded-md border border-sand-300 bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink/40 focus:border-brand-400 focus:outline-none"
    />
  );
}
