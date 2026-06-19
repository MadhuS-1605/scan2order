import { describe, it, expect } from "vitest";
import { refundableAmount, clampRefund } from "@/lib/billing/refund-math";

describe("refundableAmount", () => {
  it("is the full paid amount when nothing refunded", () => {
    expect(refundableAmount(500, [])).toBe(500);
  });
  it("subtracts completed refunds only (ignores failed)", () => {
    expect(
      refundableAmount(500, [
        { amount: 100, status: "DONE" },
        { amount: 50, status: "FAILED" },
      ]),
    ).toBe(400);
  });
  it("never goes negative", () => {
    expect(refundableAmount(100, [{ amount: 100, status: "DONE" }])).toBe(0);
    expect(refundableAmount(100, [{ amount: 150, status: "DONE" }])).toBe(0);
  });
});

describe("clampRefund", () => {
  it("defaults to the full refundable amount", () => {
    expect(clampRefund(0, 400)).toBe(400);
    expect(clampRefund(NaN, 400)).toBe(400);
  });
  it("caps a too-large request at the refundable amount", () => {
    expect(clampRefund(1000, 400)).toBe(400);
  });
  it("allows a smaller partial refund", () => {
    expect(clampRefund(150, 400)).toBe(150);
  });
  it("is 0 when nothing is refundable", () => {
    expect(clampRefund(100, 0)).toBe(0);
  });
});
