import { describe, it, expect } from "vitest";
import {
  overageUnits,
  overageBreakdown,
  overageCost,
  allowanceForTier,
  gstAmount,
  withGst,
  annualPrice,
  OVERAGE_RATE,
} from "@/lib/plans";

describe("usage allowances", () => {
  it("maps tiers to monthly allowances", () => {
    expect(allowanceForTier("FREE")).toEqual({ whatsapp: 0, email: 50 });
    expect(allowanceForTier("STARTER")).toEqual({ whatsapp: 1000, email: 2000 });
    expect(allowanceForTier("PRO")).toEqual({ whatsapp: 5000, email: 10000 });
    expect(allowanceForTier("ENTERPRISE")).toEqual({ whatsapp: null, email: null });
  });
  it("falls back to FREE for unknown tiers", () => {
    expect(allowanceForTier("BOGUS")).toEqual({ whatsapp: 0, email: 50 });
  });
});

describe("overageUnits", () => {
  it("is zero under the allowance and the overage above it", () => {
    expect(overageUnits(900, 1000)).toBe(0);
    expect(overageUnits(1000, 1000)).toBe(0);
    expect(overageUnits(1200, 1000)).toBe(200);
  });
  it("treats a null (unlimited) allowance as never over", () => {
    expect(overageUnits(99999, null)).toBe(0);
  });
});

describe("overageBreakdown / overageCost", () => {
  it("prices each channel over the STARTER allowance", () => {
    const b = overageBreakdown({ whatsapp: 1200, email: 2500 }, "STARTER");
    expect(b.whatsapp).toEqual({ units: 200, cost: 200 * OVERAGE_RATE.whatsapp });
    expect(b.email).toEqual({ units: 500, cost: 500 * OVERAGE_RATE.email });
    expect(overageCost({ whatsapp: 1200, email: 2500 }, "STARTER")).toBe(
      200 * OVERAGE_RATE.whatsapp + 500 * OVERAGE_RATE.email,
    );
  });
  it("charges from the first unit when the FREE allowance is zero", () => {
    expect(overageCost({ whatsapp: 5, email: 0 }, "FREE")).toBe(5 * OVERAGE_RATE.whatsapp);
  });
  it("is free on an unlimited (ENTERPRISE) tier", () => {
    expect(overageCost({ whatsapp: 99999, email: 99999 }, "ENTERPRISE")).toBe(0);
  });
});

describe("GST + annual helpers", () => {
  it("computes 18% GST and gross", () => {
    expect(gstAmount(1000)).toBe(180);
    expect(withGst(1000)).toBe(1180);
    expect(withGst(999)).toBe(1178.82);
  });
  it("bills 11 months on annual", () => {
    expect(annualPrice(999)).toBe(10989);
  });
});
