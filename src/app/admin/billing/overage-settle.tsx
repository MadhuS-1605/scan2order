"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/admin/i18n-provider";
import {
  startOverageCheckoutAction,
  verifyOveragePaymentAction,
  mockSettleOverageAction,
} from "@/lib/billing/subscription-actions";

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpay(): Promise<RazorpayCtor | null> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

export function OverageSettle({ label }: { label: string }) {
  const router = useRouter();
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function settle() {
    setError(null);
    setBusy(true);
    try {
      const intent = await startOverageCheckoutAction();
      if (!intent.ok) {
        setError(intent.error);
        return;
      }
      if (intent.mock) {
        const r = await mockSettleOverageAction();
        if (r.ok) router.refresh();
        else setError(r.error ?? tr("billing.activateError"));
        return;
      }
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setError(tr("billing.gatewayLoadError"));
        return;
      }
      const rzp = new Razorpay({
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: intent.name,
        description: tr("billing.usageOverageDesc"),
        order_id: intent.razorpayOrderId,
        handler: async (resp: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const v = await verifyOveragePaymentAction({
            razorpayOrderId: resp.razorpay_order_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          });
          if (v.ok) router.refresh();
          else setError(v.error ?? tr("billing.verificationFailed"));
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={settle}
        disabled={busy}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
      >
        {busy ? tr("billing.processing") : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
