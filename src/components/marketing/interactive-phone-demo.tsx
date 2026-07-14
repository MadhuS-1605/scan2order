"use client";

import { useEffect, useRef, useState } from "react";
import {
  QrCode,
  UtensilsCrossed,
  ChefHat,
  ReceiptText,
  Check,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { VegMark } from "@/components/ui";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type StageId = "scan" | "order" | "cook" | "pay";

const STAGES: {
  id: StageId;
  icon: typeof QrCode;
  title: string;
  body: string;
}[] = [
  { id: "scan", icon: QrCode, title: "Scan", body: "A guest scans the unique QR on their table." },
  { id: "order", icon: UtensilsCrossed, title: "Order", body: "They browse the live menu and place an order." },
  { id: "cook", icon: ChefHat, title: "Cook", body: "The ticket appears on your kitchen screen." },
  { id: "pay", icon: ReceiptText, title: "Pay", body: "They pay online or at the counter, bill on WhatsApp." },
];

const MENU = [
  { name: "Paneer Tikka", note: "Chef's special", veg: true, price: 220 },
  { name: "Butter Chicken", note: "Rich & creamy", veg: false, price: 340 },
  { name: "Garlic Naan", note: "Stone-baked", veg: true, price: 80 },
];

const DEFAULT_CART: Record<string, boolean> = {
  "Paneer Tikka": true,
  "Butter Chicken": true,
};

// The "How it works" section, made literal: click a step (or let it
// autoplay) and the phone on the right actually walks through scanning,
// building a cart, a kitchen ticket, and a paid bill.
export function InteractivePhoneDemo() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<StageId>("scan");
  const [cart, setCart] = useState<Record<string, boolean>>(DEFAULT_CART);
  const [auto, setAuto] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (reduced || !auto) return;
    timerRef.current = setInterval(() => {
      setStage((cur) => {
        const idx = STAGES.findIndex((s) => s.id === cur);
        return STAGES[(idx + 1) % STAGES.length].id;
      });
    }, 3800);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [reduced, auto]);

  function goTo(id: StageId) {
    setAuto(false);
    setStage(id);
  }

  function toggleItem(name: string) {
    setAuto(false);
    setCart((c) => ({ ...c, [name]: !c[name] }));
  }

  function reset() {
    setCart(DEFAULT_CART);
    setStage("scan");
    setAuto(true);
  }

  const selected = MENU.filter((m) => cart[m.name]);
  const total = selected.reduce((sum, m) => sum + m.price, 0);
  const stageIndex = STAGES.findIndex((s) => s.id === stage);

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
      {/* Step nav — click any step to jump the phone straight to it */}
      <div className="space-y-2" role="tablist" aria-label="How a meal flows">
        {STAGES.map((s, i) => {
          const active = s.id === stage;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => goTo(s.id)}
              className={cn(
                "flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition-colors",
                active
                  ? "border-brand-300 bg-brand-50"
                  : "border-transparent hover:bg-sand-100/70",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors",
                  active
                    ? "border-brand-400 bg-brand-600 text-white"
                    : "border-sand-300 text-ink/40",
                )}
              >
                <s.icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              <span>
                <span
                  className={cn(
                    "block font-display text-lg",
                    active ? "text-ink" : "text-ink/70",
                  )}
                >
                  0{i + 1} · {s.title}
                </span>
                <span className="mt-0.5 block text-sm text-ink/55">{s.body}</span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 pl-4 pt-1 text-xs font-medium text-ink/45 hover:text-ink/70"
        >
          <RotateCcw className="h-3 w-3" />
          {auto ? "Playing automatically — click a step to take over" : "Replay from the start"}
        </button>
      </div>

      {/* Phone */}
      <div className="mx-auto w-full max-w-sm">
        <Card className="min-h-[23rem] rotate-1 border border-sand-200 p-5 shadow-md ring-0">
          <div key={stage} className="animate-panel-fade">
            {stage === "scan" && (
              <div className="flex min-h-[21rem] flex-col items-center justify-center gap-4 text-center">
                {/* Camera viewfinder: corner brackets + a scan line sweeping the QR */}
                <div className="relative overflow-hidden p-5">
                  <QrCode className="h-20 w-20 text-ink/70" strokeWidth={1.25} />
                  <span aria-hidden className="absolute left-0 top-0 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-brand-500" />
                  <span aria-hidden className="absolute right-0 top-0 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-brand-500" />
                  <span aria-hidden className="absolute bottom-0 left-0 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-brand-500" />
                  <span aria-hidden className="absolute bottom-0 right-0 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-brand-500" />
                  <span
                    aria-hidden
                    className="animate-scan-sweep absolute inset-x-1 h-0.5 rounded-full bg-brand-500 shadow-[0_0_12px_2px_rgba(217,61,11,0.4)]"
                  />
                </div>
                <div>
                  <p className="font-display text-lg text-ink">Spice Garden</p>
                  <p className="text-xs text-ink/45">
                    Table 4 · <span className="text-brand-600">Scanning…</span>
                  </p>
                </div>
                <button type="button" onClick={() => goTo("order")} className={buttonVariants()}>
                  Tap to scan
                </button>
              </div>
            )}

            {stage === "order" && (
              <div>
                <div className="flex items-center justify-between border-b border-dashed border-sand-300 pb-3">
                  <div>
                    <p className="font-display text-lg text-ink">Spice Garden</p>
                    <p className="text-xs text-ink/45">Table 4</p>
                  </div>
                  <span className="text-xs text-ink/40">Tap to add</span>
                </div>
                <ul className="mt-3 space-y-1">
                  {MENU.map((it) => {
                    const on = Boolean(cart[it.name]);
                    return (
                      <li key={it.name}>
                        <button
                          type="button"
                          onClick={() => toggleItem(it.name)}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                            on ? "bg-brand-50" : "hover:bg-sand-100/70",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                on ? "border-brand-600 bg-brand-600 text-white" : "border-sand-300",
                              )}
                            >
                              {on && <Check className="h-3 w-3" />}
                            </span>
                            <span>
                              <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                                <VegMark isVeg={it.veg} />
                                {it.name}
                              </span>
                              <span className="block text-xs text-ink/50">{it.note}</span>
                            </span>
                          </div>
                          <span className="whitespace-nowrap text-sm text-ink/70">₹{it.price}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={() => goTo("cook")}
                  className="mt-4 flex w-full items-center justify-between rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                >
                  <span>Place order</span>
                  <span>₹{total}</span>
                </button>
              </div>
            )}

            {stage === "cook" && (
              <div className="flex min-h-[21rem] flex-col">
                <div className="flex items-center justify-between border-b border-dashed border-sand-300 pb-3">
                  <div>
                    <p className="font-display text-lg text-ink">KOT #103</p>
                    <p className="text-xs text-ink/45">Table 4</p>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-600" />
                    Live
                  </span>
                </div>
                <ul className="mt-3 flex-1 space-y-2 font-mono text-sm text-ink/80">
                  {selected.length > 0 ? (
                    selected.map((it) => <li key={it.name}>1× {it.name}</li>)
                  ) : (
                    <li className="font-sans text-ink/45">No items — go back and add something.</li>
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => goTo("pay")}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  Ready — send the bill
                </button>
              </div>
            )}

            {stage === "pay" && (
              <div className="flex min-h-[21rem] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-olive-600/10">
                  <Check className="h-7 w-7 text-olive-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="font-display text-2xl text-ink">₹{total} paid</p>
                  <p className="mt-1 text-sm text-ink/55">Bill sent on WhatsApp</p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
                >
                  <RotateCcw className="h-4 w-4" />
                  Watch again
                </button>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-4 flex justify-center gap-1.5">
          {STAGES.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === stageIndex ? "w-6 bg-brand-600" : "w-1.5 bg-sand-300",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
