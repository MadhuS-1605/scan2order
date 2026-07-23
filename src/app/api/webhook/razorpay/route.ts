import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { verifyRazorpayWebhook } from "@/lib/payments/razorpay";
import { reconcilePaidByRazorpayOrder } from "@/lib/billing/actions";
import {
  reconcilePlanPaymentByRazorpayOrder,
  reconcileSubscriptionEvent,
} from "@/lib/billing/subscription-actions";
import { reconcileOverageByRazorpayOrder } from "@/lib/billing/overage";
import { notifyOps } from "@/lib/platform/alerts";

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
    // Could be a misconfigured RAZORPAY_WEBHOOK_SECRET (which would silently
    // reject every real webhook, not just this one) or a probing attempt —
    // either way it's worth a human noticing rather than a silent 400.
    await notifyOps(
      "Razorpay webhook: invalid signature",
      "A webhook call failed signature verification. If this keeps happening, RAZORPAY_WEBHOOK_SECRET likely doesn't match the Razorpay dashboard config — every real payment confirmation would be silently dropped.",
    );
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
    await notifyOps("Razorpay webhook: bad payload", "A signature-verified webhook body wasn't valid JSON.");
    return new Response("Bad payload", { status: 400 });
  }

  const type = event.event ?? "";

  // Confirm on capture/paid; ignore everything else (still 200 so Razorpay
  // doesn't retry indefinitely).
  if (type === "payment.captured" || type === "order.paid") {
    const entity = event.payload?.payment?.entity;
    const razorpayOrderId = entity?.order_id;
    if (razorpayOrderId) {
      // Idempotent. The same order-id space is shared by diner order payments,
      // tenant plan payments (which also settle any bundled overage), and
      // standalone overage orders — try each in turn.
      const settled = await reconcilePaidByRazorpayOrder(razorpayOrderId, entity?.id);
      if (!settled.ok) {
        const plan = await reconcilePlanPaymentByRazorpayOrder(razorpayOrderId, entity?.id);
        if (!plan.ok) {
          const overage = await reconcileOverageByRazorpayOrder(razorpayOrderId, entity?.id);
          if (!overage?.ok) {
            // Razorpay confirms money was captured, but it matches no diner
            // order, plan payment, or overage charge we know about — this is
            // the case that actually loses money if nobody looks at it.
            await prisma.paymentReconciliationEvent.create({
              data: {
                type: "UNMATCHED_PAYMENT",
                reference: razorpayOrderId,
                detail: `payment_id=${entity?.id ?? "?"}`,
              },
            });
            await notifyOps(
              "Razorpay payment captured for an unrecognized order",
              `razorpay_order_id=${razorpayOrderId} payment_id=${entity?.id ?? "?"} — captured but didn't match any order/plan/overage record. Check the Razorpay dashboard and reconcile manually.`,
            );
          }
        }
      }
    }
  } else if (type.startsWith("subscription.")) {
    // Auto-renew lifecycle: charged/activated extend the plan; cancelled/halted stop it.
    const subId = event.payload?.subscription?.entity?.id;
    if (subId) {
      const result = await reconcileSubscriptionEvent(type, subId, event.payload?.payment?.entity?.id);
      if (!result.ok) {
        // Same shape as the unrecognized-payment case above: Razorpay confirms
        // a real subscription event, but no restaurant has this subscription
        // id on record — e.g. a `.charged` event never extends the tenant's
        // plan, and nobody would otherwise know.
        await prisma.paymentReconciliationEvent.create({
          data: { type: "UNMATCHED_SUBSCRIPTION", reference: subId, detail: `event=${type}` },
        });
        await notifyOps(
          "Razorpay subscription event for an unrecognized subscription",
          `event=${type} razorpay_subscription_id=${subId} — didn't match any restaurant. Check the Razorpay dashboard and reconcile manually.`,
        );
      }
    }
  }

  return new Response("ok", { status: 200 });
}
