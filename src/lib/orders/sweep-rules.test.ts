import { describe, it, expect } from "vitest";
import {
  PENDING_RECOVER_MIN,
  PREPAID_ABANDON_MIN,
  pendingRecoverCutoff,
  prepaidAbandonCutoff,
} from "@/lib/orders/sweep-rules";

const now = new Date(2026, 0, 1, 12, 0);
const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000);

describe("sweep cutoffs", () => {
  it("pending cutoff is PENDING_RECOVER_MIN before now", () => {
    expect(pendingRecoverCutoff(now)).toEqual(minsAgo(PENDING_RECOVER_MIN));
  });
  it("abandon cutoff is PREPAID_ABANDON_MIN before now", () => {
    expect(prepaidAbandonCutoff(now)).toEqual(minsAgo(PREPAID_ABANDON_MIN));
  });
  it("a 10-min-old PENDING order is NOT yet recoverable; a 40-min-old one is", () => {
    expect(minsAgo(10) < pendingRecoverCutoff(now)).toBe(false);
    expect(minsAgo(40) < pendingRecoverCutoff(now)).toBe(true);
  });
  it("a 60-min-old prepaid order is NOT yet abandoned; a 120-min-old one is", () => {
    expect(minsAgo(60) < prepaidAbandonCutoff(now)).toBe(false);
    expect(minsAgo(120) < prepaidAbandonCutoff(now)).toBe(true);
  });
});
