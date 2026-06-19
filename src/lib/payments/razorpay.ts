import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";

export type RazorpayCreds = { keyId: string; keySecret: string };

// Resolve credentials: prefer per-restaurant keys, fall back to platform env.
export function resolveRazorpayCreds(config: {
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
}): RazorpayCreds | null {
  if (config.razorpayKeyId && config.razorpayKeySecret) {
    return { keyId: config.razorpayKeyId, keySecret: config.razorpayKeySecret };
  }
  if (env.razorpay.keyId && env.razorpay.keySecret) {
    return { keyId: env.razorpay.keyId, keySecret: env.razorpay.keySecret };
  }
  return null;
}

// Creates a Razorpay order. amountRupees is converted to paise.
export async function createRazorpayOrder(
  creds: RazorpayCreds,
  amountRupees: number,
  currency: string,
  receipt: string,
): Promise<{ id: string; amount: number }> {
  const { default: Razorpay } = await import("razorpay");
  const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
  const order = await rzp.orders.create({
    amount: Math.round(amountRupees * 100),
    currency,
    receipt,
  });
  return { id: order.id, amount: Number(order.amount) };
}

// Refunds a captured payment (full or partial). amountRupees -> paise. Returns
// the gateway refund id. Throws if Razorpay rejects (caller records FAILED).
export async function refundRazorpayPayment(
  creds: RazorpayCreds,
  paymentId: string,
  amountRupees: number,
): Promise<{ id: string }> {
  const { default: Razorpay } = await import("razorpay");
  const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
  const refund = await rzp.payments.refund(paymentId, {
    amount: Math.round(amountRupees * 100),
    speed: "normal",
  });
  return { id: refund.id };
}

// Creates a Razorpay Subscription (auto-renew via eMandate). totalCount caps the
// number of billing cycles. Returns the subscription id used at checkout.
export async function createRazorpaySubscription(
  creds: RazorpayCreds,
  planId: string,
  totalCount = 120,
): Promise<{ id: string }> {
  const { default: Razorpay } = await import("razorpay");
  const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
  const sub = await rzp.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    customer_notify: 1,
  });
  return { id: sub.id };
}

export async function cancelRazorpaySubscription(
  creds: RazorpayCreds,
  subscriptionId: string,
): Promise<void> {
  const { default: Razorpay } = await import("razorpay");
  const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
  await rzp.subscriptions.cancel(subscriptionId);
}

// Subscription checkout signature: HMAC-SHA256 of "paymentId|subscriptionId".
export function verifyRazorpaySubscriptionSignature(
  keySecret: string,
  razorpayPaymentId: string,
  razorpaySubscriptionId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpayPaymentId}|${razorpaySubscriptionId}`)
    .digest("hex");
  return expected === signature;
}

// Verifies a Razorpay webhook: HMAC-SHA256 of the RAW request body using the
// webhook secret, compared to the X-Razorpay-Signature header.
export function verifyRazorpayWebhook(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return expected === signature;
}

// Verifies the checkout signature (HMAC-SHA256 of "orderId|paymentId").
export function verifyRazorpaySignature(
  keySecret: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");
  return expected === signature;
}
