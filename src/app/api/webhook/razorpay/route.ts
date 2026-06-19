import { env } from "@/lib/env";
import { verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { reconcilePaidByRazorpayOrder } from "@/lib/billing/actions";
import {
  reconcilePlanPaymentByRazorpayOrder,
  reconcileSubscriptionEvent,
} from "@/lib/billing/subscription-actions";

export const runtime = "nodejs";

// Server-to-server payment confirmation from Razorpay. This is the source of
// truth that survives a diner closing the tab before the client callback runs —
// without it, a captured payment could leave the order stuck UNPAID.
// Configure in the Razorpay dashboard: URL = <app>/api/webhook/razorpay,
// secret = RAZORPAY_WEBHOOK_SECRET, events = payment.captured (and order.paid).
export async function POST(request: Request) {
  const secret = env.razorpay.webhookSecret;
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const raw = await request.text();
  if (!verifyRazorpayWebhook(secret, raw, signature)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { order_id?: string; id?: string } };
      subscription?: { entity?: { id?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const type = event.event ?? "";

  // Confirm on capture/paid; ignore everything else (still 200 so Razorpay
  // doesn't retry indefinitely).
  if (type === "payment.captured" || type === "order.paid") {
    const entity = event.payload?.payment?.entity;
    const razorpayOrderId = entity?.order_id;
    if (razorpayOrderId) {
      // Idempotent. Same order id space is split between diner order payments
      // and tenant plan payments — try the diner path, then the plan path.
      const settled = await reconcilePaidByRazorpayOrder(razorpayOrderId, entity?.id);
      if (!settled.ok) {
        await reconcilePlanPaymentByRazorpayOrder(razorpayOrderId, entity?.id);
      }
    }
  } else if (type.startsWith("subscription.")) {
    // Auto-renew lifecycle: charged/activated extend the plan; cancelled/halted stop it.
    const subId = event.payload?.subscription?.entity?.id;
    if (subId) await reconcileSubscriptionEvent(type, subId);
  }

  return new Response("ok", { status: 200 });
}
