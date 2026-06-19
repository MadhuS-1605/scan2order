"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  startAutoRenewAction,
  verifyAutoRenewAction,
  cancelAutoRenewAction,
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

// Toggle auto-renew (Razorpay subscription / eMandate) for the current paid plan.
export function AutoRenew({ tier, enabled }: { tier: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (enabled) {
    return (
      <form action={cancelAutoRenewAction} className="mt-2 text-center">
        <span className="text-xs text-olive-700">↻ Auto-renew on</span>{" "}
        <button type="submit" className="text-xs text-ink/45 underline hover:text-red-600">
          cancel
        </button>
      </form>
    );
  }

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      const intent = await startAutoRenewAction(tier);
      if (!intent.ok) {
        setError(intent.error);
        return;
      }
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setError("Could not load the payment gateway.");
        return;
      }
      const rzp = new Razorpay({
        key: intent.keyId,
        subscription_id: intent.subscriptionId,
        name: intent.name,
        handler: async (resp: {
          razorpay_payment_id: string;
          razorpay_subscription_id: string;
          razorpay_signature: string;
        }) => {
          const v = await verifyAutoRenewAction({
            tier,
            razorpaySubscriptionId: resp.razorpay_subscription_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          });
          if (v.ok) router.refresh();
          else setError(v.error ?? "Verification failed.");
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 text-center">
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="text-xs font-medium text-brand-600 underline hover:text-brand-700 disabled:opacity-60"
      >
        {busy ? "Setting up…" : "Set up auto-renew"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
