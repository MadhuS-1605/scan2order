"use client";

import { useEffect, useState } from "react";
import { type Cart, type CartLine, cartCount, lineKey } from "@/lib/customer/cart";

// Owns the diner's cart, persisted to localStorage so it survives refreshes and
// is shared across the /menu, /cart and /checkout routes. Keyed by restaurantId
// (not the table token) so the cart follows the diner if they move tables within
// the same venue. `prefill` (the "reorder" flow) seeds the cart and, when
// present, takes precedence over any stored cart.
export function useCart(
  restaurantId: string,
  opts: { prefill?: { itemId: string; qty: number }[] } = {},
) {
  const cartKey = `sto_cart_${restaurantId}`;
  const prefill = opts.prefill;

  const [cart, setCart] = useState<Cart>(() => {
    const init: Cart = {};
    for (const p of prefill ?? []) {
      if (p.qty > 0)
        init[lineKey(p.itemId, [])] = {
          itemId: p.itemId,
          qty: p.qty,
          optionIds: [],
        };
    }
    return init;
  });
  // `ready` flips once we've hydrated from localStorage; callers use it to avoid
  // flashing an empty cart before restore, and it gates the save effect so the
  // initial empty render can't clobber a stored cart.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (!prefill?.length) {
        const saved = localStorage.getItem(cartKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Cart;
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
            setCart(parsed);
          }
        }
      }
    } catch {
      /* ignore corrupt/unavailable storage */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      if (Object.keys(cart).length) localStorage.setItem(cartKey, JSON.stringify(cart));
      else localStorage.removeItem(cartKey);
    } catch {
      /* ignore */
    }
  }, [cart, ready, cartKey]);

  function addLine(itemId: string, optionIds: string[], delta = 1) {
    setCart((c) => {
      const key = lineKey(itemId, optionIds);
      const qty = (c[key]?.qty ?? 0) + delta;
      const next = { ...c };
      if (qty <= 0) delete next[key];
      // Spread the existing line so a quantity change keeps the per-item note.
      else next[key] = { ...c[key], itemId, optionIds, qty };
      return next;
    });
  }

  // Set (or clear) the per-item note on an existing cart line, by its key.
  function setNote(key: string, notes: string) {
    setCart((c) => {
      if (!c[key]) return c;
      return { ...c, [key]: { ...c[key], notes: notes || undefined } };
    });
  }

  function clear() {
    setCart({});
  }

  return { cart, ready, count: cartCount(cart), addLine, setNote, clear } as const;
}

export type { Cart, CartLine };
