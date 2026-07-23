import { describe, it, expect } from "vitest";
import { slotBucketMs, capacityExceeded } from "./slots";

describe("slotBucketMs", () => {
  it("buckets times into the same 30-minute slot", () => {
    const a = new Date("2026-01-01T19:00:00Z");
    const b = new Date("2026-01-01T19:29:00Z");
    const c = new Date("2026-01-01T19:30:00Z");
    expect(slotBucketMs(a, 30)).toBe(slotBucketMs(b, 30));
    expect(slotBucketMs(a, 30)).not.toBe(slotBucketMs(c, 30));
  });
});

describe("capacityExceeded", () => {
  it("allows booking under capacity", () => {
    expect(capacityExceeded([4, 2], 4, 20)).toBe(false);
  });

  it("blocks booking that would exceed capacity", () => {
    expect(capacityExceeded([10, 8], 4, 20)).toBe(true);
  });

  it("treats null capacity as uncapped", () => {
    expect(capacityExceeded([1000], 1000, null)).toBe(false);
  });

  it("allows exactly filling capacity", () => {
    expect(capacityExceeded([16], 4, 20)).toBe(false);
  });
});
