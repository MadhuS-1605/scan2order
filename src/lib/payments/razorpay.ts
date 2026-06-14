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
