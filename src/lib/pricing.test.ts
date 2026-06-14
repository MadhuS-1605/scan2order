import { describe, it, expect } from "vitest";
import { computeTotals, round2 } from "@/lib/pricing";

describe("round2", () => {
  it("rounds float noise to 2dp", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01); // EPSILON nudge → rounds half up
    expect(round2(99.999)).toBe(100);
  });
});

describe("computeTotals", () => {
  it("NONE: total equals subtotal, no tax", () => {
    const t = computeTotals([{ price: 100, quantity: 2 }], "NONE", 0);
    expect(t.subtotal).toBe(200);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(200);
  });

  it("EXCLUSIVE: GST added on top", () => {
    const t = computeTotals([{ price: 100, quantity: 1 }], "EXCLUSIVE", 5);
    expect(t.subtotal).toBe(100);
    expect(t.taxAmount).toBe(5);
    expect(t.total).toBe(105);
  });

  it("INCLUSIVE: GST backed out of the gross", () => {
    const t = computeTotals([{ price: 105, quantity: 1 }], "INCLUSIVE", 5);
    expect(t.subtotal).toBe(100);
    expect(t.taxAmount).toBe(5);
    expect(t.total).toBe(105);
  });

  it("0% rate behaves like NONE even when mode is EXCLUSIVE", () => {
    const t = computeTotals([{ price: 50, quantity: 3 }], "EXCLUSIVE", 0);
    expect(t.taxAmount).toBe(0);
    expect(t.total).toBe(150);
  });

  it("sums multiple lines", () => {
    const t = computeTotals(
      [
        { price: 99.5, quantity: 2 },
        { price: 10, quantity: 1 },
      ],
      "NONE",
      0,
    );
    expect(t.total).toBe(209);
  });
});
