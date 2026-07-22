import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";

// Constant-time comparison of two hex strings (avoids signature timing oracles).
export function timingEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export type RazorpayCreds = { keyId: string; keySecret: string };

// Resolve credentials: prefer per-restaurant keys, fall back to platform env.
export function resolveRazorpayCreds(config: {
  razorpayKeyId: string | null;
  razorpayKeySecret: string | null;
}): RazorpayCreds | null {
  if (config.razorpayKeyId && config.razorpayKeySecret) {
    // Stored encrypted at rest (decryptSecret passes through legacy plaintext).
    return { keyId: config.razorpayKeyId, keySecret: decryptSecret(config.razorpayKeySecret) };
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

// Fetch a payment from Razorpay to confirm what was actually captured. Returns
// the gateway's status, the order it belongs to, and the amount in PAISE.
export async function fetchRazorpayPayment(
  creds: RazorpayCreds,
  paymentId: string,
): Promise<{ status: string; orderId: string | null; amountPaise: number } | null> {
  try {
    const { default: Razorpay } = await import("razorpay");
    const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
    const p = await rzp.payments.fetch(paymentId);
    return {
      status: String(p.status),
      orderId: p.order_id ? String(p.order_id) : null,
      amountPaise: Number(p.amount),
    };
  } catch {
    return null;
  }
}

// Fetch every payment attempt against a Razorpay order — used to check for a
// captured payment when our own PENDING order has gone stale (e.g. the
// webhook was delayed or dropped), so a slow webhook never gets mistaken for
// a failed payment and re-charges the diner. Returns null on lookup failure
// (caller treats that the same as "nothing found" and falls back to reverting).
export async function fetchCapturedPaymentForOrder(
  creds: RazorpayCreds,
  razorpayOrderId: string,
): Promise<{ id: string; amountPaise: number } | null> {
  try {
    const { default: Razorpay } = await import("razorpay");
    const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
    const { items } = await rzp.orders.fetchPayments(razorpayOrderId);
    const captured = items.find((p) => p.status === "captured");
    if (!captured) return null;
    return { id: String(captured.id), amountPaise: Number(captured.amount) };
  } catch {
    return null;
  }
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

// Fetch a subscription to learn which plan it's actually on (for server-side
// tier derivation, instead of trusting a client-supplied tier).
export async function fetchRazorpaySubscription(
  creds: RazorpayCreds,
  subscriptionId: string,
): Promise<{ planId: string | null } | null> {
  try {
    const { default: Razorpay } = await import("razorpay");
    const rzp = new Razorpay({ key_id: creds.keyId, key_secret: creds.keySecret });
    const s = await rzp.subscriptions.fetch(subscriptionId);
    return { planId: s.plan_id ? String(s.plan_id) : null };
  } catch {
    return null;
  }
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
  return timingEqualHex(expected, signature);
}

// Verifies a Razorpay webhook: HMAC-SHA256 of the RAW request body using the
// webhook secret, compared to the X-Razorpay-Signature header.
export function verifyRazorpayWebhook(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return timingEqualHex(expected, signature);
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
  return timingEqualHex(expected, signature);
}
