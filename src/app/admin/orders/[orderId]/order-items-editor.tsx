"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Minus, Trash2 } from "lucide-react";
import {
  addOrderItemAction,
  setOrderItemQtyAction,
} from "@/lib/orders/staff-actions";
import { Button } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type Line = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  lineTotal: number;
  notes: string | null;
};

export function OrderItemsEditor({
  orderId,
  items,
  menu,
  currency,
}: {
  orderId: string;
  items: Line[];
  menu: { id: string; name: string }[];
  currency: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [addId, setAddId] = useState(menu[0]?.id ?? "");

  function setQty(orderItemId: string, quantity: number) {
    start(async () => {
      const fd = new FormData();
      fd.set("orderItemId", orderItemId);
      fd.set("quantity", String(quantity));
      await setOrderItemQtyAction(fd);
      router.refresh();
    });
  }
  function add() {
    if (!addId) return;
    start(async () => {
      const fd = new FormData();
      fd.set("orderId", orderId);
      fd.set("menuItemId", addId);
      fd.set("quantity", "1");
      await addOrderItemAction(fd);
      router.refresh();
    });
  }

  return (
    <div className={pending ? "pointer-events-none opacity-60" : ""}>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="text-ink/85">{it.nameSnapshot}</span>
              {it.notes && <span className="block text-xs text-brand-700">↳ {it.notes}</span>}
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="w-16 text-right text-ink/60">
                {formatMoney(it.lineTotal, currency)}
              </span>
              <span className="flex items-center gap-1.5 rounded-lg border border-sand-300">
                <button
                  className="px-2 py-1 text-ink/70"
                  onClick={() => setQty(it.id, it.quantity - 1)}
                  aria-label="decrease"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-5 text-center font-medium">{it.quantity}</span>
                <button
                  className="px-2 py-1 text-ink/70"
                  onClick={() => setQty(it.id, it.quantity + 1)}
                  aria-label="increase"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </span>
              <button
                onClick={() => setQty(it.id, 0)}
                aria-label="remove item"
                className="text-ink/30 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-2 border-t border-sand-100 pt-3">
        <select
          value={addId}
          onChange={(e) => setAddId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-sand-300 bg-surface px-2 py-1.5 text-sm"
        >
          {menu.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" onClick={add} disabled={!addId}>
          <Plus className="h-3.5 w-3.5" /> Add item
        </Button>
      </div>
    </div>
  );
}
