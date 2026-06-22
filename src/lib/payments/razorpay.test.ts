import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  timingEqualHex,
  verifyRazorpaySignature,
  verifyRazorpayWebhook,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/payments/razorpay";

describe("timingEqualHex", () => {
  it("matches equal hex and rejects mismatches", () => {
    expect(timingEqualHex("deadbeef", "deadbeef")).toBe(true);
    expect(timingEqualHex("deadbeef", "deadbee0")).toBe(false);
  });
  it("rejects length mismatch and non-strings without throwing", () => {
    expect(timingEqualHex("ab", "abcd")).toBe(false);
    // @ts-expect-error — defensive against non-string input
    expect(timingEqualHex(undefined, "abcd")).toBe(false);
  });
});

describe("verifyRazorpaySignature (checkout)", () => {
  const secret = "key_secret_value";
  const sig = createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
  it("accepts the genuine signature", () => {
    expect(verifyRazorpaySignature(secret, "order_1", "pay_1", sig)).toBe(true);
  });
  it("rejects a forged signature, wrong secret, or swapped ids", () => {
    expect(verifyRazorpaySignature(secret, "order_1", "pay_1", "0".repeat(64))).toBe(false);
    expect(verifyRazorpaySignature("other", "order_1", "pay_1", sig)).toBe(false);
    expect(verifyRazorpaySignature(secret, "order_2", "pay_1", sig)).toBe(false);
  });
});

describe("verifyRazorpayWebhook", () => {
  const secret = "whsec";
  const body = '{"event":"payment.captured"}';
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  it("verifies the HMAC over the raw body", () => {
    expect(verifyRazorpayWebhook(secret, body, sig)).toBe(true);
  });
  it("rejects a tampered body or wrong secret", () => {
    expect(verifyRazorpayWebhook(secret, body + " ", sig)).toBe(false);
    expect(verifyRazorpayWebhook("nope", body, sig)).toBe(false);
  });
});

describe("verifyRazorpaySubscriptionSignature", () => {
  const secret = "ks";
  const sig = createHmac("sha256", secret).update("pay_1|sub_1").digest("hex");
  it("accepts genuine, rejects forged", () => {
    expect(verifyRazorpaySubscriptionSignature(secret, "pay_1", "sub_1", sig)).toBe(true);
    expect(verifyRazorpaySubscriptionSignature(secret, "pay_1", "sub_2", sig)).toBe(false);
  });
});
