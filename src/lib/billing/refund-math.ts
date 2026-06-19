import { round2 } from "@/lib/pricing";

// Pure refund math, isolated from the DB/action so it can be unit-tested. These
// guard against over-refunding (the money-critical invariant).

// How much is still refundable on an order: amount paid minus refunds already
// completed. Never negative.
export function refundableAmount(
  amountPaid: number,
  refunds: { amount: number; status: string }[],
): number {
  const done = refunds
    .filter((r) => r.status === "DONE")
    .reduce((s, r) => s + r.amount, 0);
  return Math.max(0, round2(amountPaid - done));
}

// The actual amount to refund: the requested amount capped at what's refundable,
// or the full refundable amount when no specific amount is requested.
export function clampRefund(requested: number, refundable: number): number {
  if (refundable <= 0) return 0;
  return round2(requested && requested > 0 ? Math.min(requested, refundable) : refundable);
}
