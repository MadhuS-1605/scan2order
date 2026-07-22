"use client";

import { useState, useTransition } from "react";
import { Bell, GlassWater, ReceiptText, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { createServiceRequestAction } from "@/lib/service/actions";
import type { ServiceRequestType } from "@prisma/client";

const OPTIONS: {
  type: ServiceRequestType;
  label: string;
  icon: typeof Bell;
}[] = [
  { type: "CALL_WAITER", label: "Call waiter", icon: Bell },
  { type: "WATER", label: "Water, please", icon: GlassWater },
  { type: "BILL", label: "Request the bill", icon: ReceiptText },
  { type: "CLEAN_TABLE", label: "Clean my table", icon: Sparkles },
];

export function ServiceButton({ qrToken }: { qrToken: string }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function send(type: ServiceRequestType, label: string) {
    setError(null);
    start(async () => {
      // A dropped connection here throws rather than returning — without this
      // catch it's an unhandled rejection that resets the whole ordering page
      // (same failure mode fixed in checkout-form.tsx).
      try {
        await createServiceRequestAction({ qrToken, type });
        setOpen(false);
        setSent(label);
        setTimeout(() => setSent(null), 3500);
      } catch {
        setError("Couldn't send — check your connection and try again.");
      }
    });
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-olive-500/10 px-3 py-1.5 text-sm font-medium text-olive-600">
        <Check className="h-4 w-4" />
        {sent} — on the way
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/75 transition-colors hover:border-brand-300 hover:bg-sand-100"
      >
        <Bell className="h-4 w-4" />
        Service
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-sand-200 bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-sand-100 px-3 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-ink/45">
                Ask for
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-ink/40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 border-b border-sand-100 px-3 py-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            {OPTIONS.map((o) => (
              <button
                key={o.type}
                disabled={pending}
                onClick={() => send(o.type, o.label)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-ink hover:bg-sand-100 disabled:opacity-60"
              >
                <o.icon className="h-4 w-4 text-brand-600" />
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
