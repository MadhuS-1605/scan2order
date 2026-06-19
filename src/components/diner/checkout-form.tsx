"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { placeOrderAction } from "@/lib/customer/actions";
import { formatMoney } from "@/lib/utils";
import { localize } from "@/lib/languages";
import { Button, Input, Textarea, Alert } from "@/components/ui";
import { CustomerHeader, PoweredBy } from "@/components/customer-header";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import { MethodButton } from "@/components/diner/controls";
import { type Item, cartSubtotal, optionLabels, optionPrice } from "@/lib/customer/cart";
import { useCart } from "@/lib/customer/use-cart";

export function CheckoutForm({
  qrToken,
  restaurantId,
  happyHourPercent,
  restaurant,
  table,
  config,
  items,
}: {
  qrToken: string;
  restaurantId: string;
  happyHourPercent: number;
  restaurant: { name: string; currency: string; groupName?: string | null; logoUrl?: string | null };
  table: { label: string; kind?: string };
  config: {
    paymentTiming: string;
    onlinePaymentEnabled: boolean;
    counterPaymentEnabled: boolean;
    requireDinerLocation: boolean;
    minOrderAmount: number;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
  };
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
  const payBefore = config.paymentTiming === "PAY_BEFORE";
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const router = useRouter();
  const { cart, ready, count, clear } = useCart(restaurantId);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  // The current dining session (set after the first round this visit). While
  // active we reuse the diner's name/phone and only ask for per-round notes.
  const [dine, setDine] = useState<{ id: string; name: string; phone: string } | null>(
    null,
  );
  const [method, setMethod] = useState<"ONLINE" | "COUNTER">(
    config.onlinePaymentEnabled ? "ONLINE" : "COUNTER",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Fulfilment: only offered when the venue enables takeaway/delivery.
  const offersFulfillment = config.pickupEnabled || config.deliveryEnabled;
  const [fulfillment, setFulfillment] = useState<"DINE_IN" | "PICKUP" | "DELIVERY">(
    table.kind === "COUNTER" && config.pickupEnabled ? "PICKUP" : "DINE_IN",
  );
  const [address, setAddress] = useState("");
  const addressNeeded = fulfillment === "DELIVERY" && address.trim().length < 8;
  // Set the instant an order is placed so clearing the cart below doesn't trip
  // the "empty cart -> /cart" redirect and clobber the push to the status page.
  const placed = useRef(false);

  const cartKey = `sto_cart_${restaurantId}`;
  const dineKey = `sto_dine_${restaurantId}`;

  // Restore an in-progress dining session (rounds before the bill is paid).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(dineKey);
      if (saved) {
        const d = JSON.parse(saved) as { id: string; name: string; phone: string };
        if (d?.id) {
          setDine(d);
          setName(d.name || "");
          setPhone(d.phone || "");
        }
      }
    } catch {
      /* ignore */
    }
  }, [dineKey]);

  // Nothing to check out — send the diner back to the cart. Skipped once an
  // order has been placed (we clear the cart then and navigate to the status
  // page; this effect must not race that navigation back to /cart).
  useEffect(() => {
    if (ready && count === 0 && !placed.current) router.replace("/cart");
  }, [ready, count, router]);

  const subtotal = cartSubtotal(cart, byId, hhFactor);
  const belowMin = config.minOrderAmount > 0 && subtotal < config.minOrderAmount;

  // Best-effort device location — resolves undefined if denied/unavailable so a
  // privacy-conscious diner is never blocked (the order is held for staff
  // confirmation instead). Only requested when the venue requires presence.
  function getCoords(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  function placeOrder() {
    if (belowMin || addressNeeded) return;
    setError(null);
    const lineItems = Object.values(cart).map((l) => ({
      menuItemId: l.itemId,
      quantity: l.qty,
      optionIds: l.optionIds,
      notes: l.notes || undefined,
    }));
    if (lineItems.length === 0) return;
    startTransition(async () => {
      const coords = config.requireDinerLocation ? await getCoords() : {};
      const res = await placeOrderAction({
        qrToken,
        items: lineItems,
        customerName: name || undefined,
        customerPhone: phone || undefined,
        notes: notes || undefined,
        paymentMethod: payBefore ? method : undefined,
        fulfillment: offersFulfillment ? fulfillment : undefined,
        deliveryAddress: fulfillment === "DELIVERY" ? address.trim() : undefined,
        sessionId: dine?.id,
        latitude: coords.lat,
        longitude: coords.lng,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      placed.current = true;
      // Remember the dining session so later rounds reuse name/phone and the
      // bill consolidates. Cleared once the bill is paid (on the bill screen).
      try {
        localStorage.removeItem(cartKey);
        localStorage.setItem(
          dineKey,
          JSON.stringify({
            id: res.sessionId,
            name: dine?.name || name,
            phone: dine?.phone || phone,
          }),
        );
      } catch {
        /* ignore */
      }
      clear();
      // Pay-first online → go straight to payment; otherwise to the status page.
      router.push(
        res.needsOnlinePayment
          ? `/payment?order=${res.orderId}`
          : `/order/${res.orderId}`,
      );
    });
  }

  const lines = Object.entries(cart);

  return (
    <div className="min-h-screen bg-grain pb-36">
      <CustomerHeader
        restaurantName={restaurant.name}
        groupName={restaurant.groupName}
        logoUrl={restaurant.logoUrl}
        seat={seat}
      />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 sm:py-8">
        <h1 className="font-display text-2xl text-ink">Checkout</h1>

        {error && <Alert>{error}</Alert>}

        {/* Order recap */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Your order</h2>
            <Link href="/cart" className="text-sm font-medium text-brand-600">
              Edit
            </Link>
          </div>
          <ul className="space-y-1.5 text-sm text-ink/80">
            {lines.map(([key, l]) => {
              const it = byId.get(l.itemId);
              if (!it) return null;
              const labels = optionLabels(it, l.optionIds);
              return (
                <li key={key} className="flex justify-between gap-2">
                  <span className="min-w-0">
                    {l.qty}× {localize(it, it.translations, "en").name}
                    {labels.length > 0 && (
                      <span className="text-ink/45"> ({labels.join(" · ")})</span>
                    )}
                    {l.notes && (
                      <span className="block text-xs text-ink/45">📝 {l.notes}</span>
                    )}
                  </span>
                  <span className="shrink-0">
                    {formatMoney(optionPrice(it, l.optionIds, hhFactor) * l.qty, cur)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3">
            <span className="text-sm text-ink/55">Subtotal</span>
            <span className="font-display text-lg text-ink">
              {formatMoney(subtotal, cur)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink/45">
            Taxes (if any) are calculated on your bill.
          </p>
        </div>

        {/* Fulfilment (takeaway / delivery) */}
        {offersFulfillment && (
          <div className="space-y-3 rounded-2xl border border-sand-200 bg-surface p-5">
            <p className="text-sm font-medium text-ink/80">How would you like it?</p>
            <div className="flex flex-wrap gap-2">
              {table.kind !== "COUNTER" && (
                <MethodButton
                  active={fulfillment === "DINE_IN"}
                  onClick={() => setFulfillment("DINE_IN")}
                  label="Dine in"
                />
              )}
              {config.pickupEnabled && (
                <MethodButton
                  active={fulfillment === "PICKUP"}
                  onClick={() => setFulfillment("PICKUP")}
                  label="Pickup"
                />
              )}
              {config.deliveryEnabled && (
                <MethodButton
                  active={fulfillment === "DELIVERY"}
                  onClick={() => setFulfillment("DELIVERY")}
                  label="Delivery"
                />
              )}
            </div>
            {fulfillment === "DELIVERY" && (
              <Textarea
                placeholder="Delivery address (flat, street, landmark, PIN)"
                aria-label="Delivery address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            )}
          </div>
        )}

        {/* Diner details */}
        <div className="space-y-3 rounded-2xl border border-sand-200 bg-surface p-5">
          {dine ? (
            <p className="rounded-lg bg-sand-100 px-3 py-2 text-sm text-ink/70">
              Adding to your tab{dine.name ? ` — ${dine.name}` : ""}. Your earlier
              items stay on one bill.
            </p>
          ) : (
            <>
              <Input
                placeholder="Your name (optional)"
                aria-label="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Mobile number (optional)"
                aria-label="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
              />
            </>
          )}
          <Textarea
            placeholder="Any notes for the kitchen? (optional)"
            aria-label="Notes for the kitchen"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          {payBefore && (
            <div>
              <p className="mb-1 text-sm font-medium text-ink/80">Payment</p>
              <div className="flex gap-2">
                {config.onlinePaymentEnabled && (
                  <MethodButton
                    active={method === "ONLINE"}
                    onClick={() => setMethod("ONLINE")}
                    label="Pay online"
                  />
                )}
                {config.counterPaymentEnabled && (
                  <MethodButton
                    active={method === "COUNTER"}
                    onClick={() => setMethod("COUNTER")}
                    label="Pay at counter"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {config.requireDinerLocation && (
          <p className="px-1 text-xs text-ink/45">
            📍 We&apos;ll check your location to confirm you&apos;re at the
            restaurant. If you prefer not to share it, your order is still placed —
            a staff member will confirm it at your table.
          </p>
        )}

        <PoweredBy />
      </div>

      <div className="fixed inset-x-0 bottom-[52px] z-20 border-t border-sand-200 bg-surface p-3">
        <div className="mx-auto max-w-lg">
          {belowMin && (
            <p className="mb-2 text-center text-xs font-medium text-amber-700">
              Minimum order is {cur} {config.minOrderAmount} — add{" "}
              {formatMoney(config.minOrderAmount - subtotal, cur)} more to continue.
            </p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={placeOrder}
            disabled={pending || count === 0 || belowMin || addressNeeded}
          >
            {pending
              ? "Placing order…"
              : payBefore && method === "ONLINE"
                ? "Place order & pay"
                : "Place order"}
          </Button>
        </div>
      </div>

      <CustomerTabBar />
    </div>
  );
}
