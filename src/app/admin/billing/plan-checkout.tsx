"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/admin/i18n-provider";
import {
  startPlanCheckoutAction,
  verifyPlanPaymentAction,
  mockActivatePlanAction,
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

export function PlanCheckout({
  tier,
  label,
  variant = "primary",
}: {
  tier: string;
  label: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const tr = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setError(null);
    setBusy(true);
    try {
      const intent = await startPlanCheckoutAction(tier);
      if (!intent.ok) {
        setError(intent.error);
        return;
      }
      if (intent.mock) {
        const r = await mockActivatePlanAction(tier);
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
        description: `${label} subscription`,
        order_id: intent.razorpayOrderId,
        handler: async (resp: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const v = await verifyPlanPaymentAction({
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
        onClick={subscribe}
        disabled={busy}
        className={`w-full rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60 ${
          variant === "primary"
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : "border border-sand-300 text-ink/70 hover:bg-sand-100"
        }`}
      >
        {busy ? tr("billing.processing") : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
