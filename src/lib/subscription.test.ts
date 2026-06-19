import { describe, it, expect } from "vitest";
import { subscriptionState } from "@/lib/subscription";

const now = new Date(2026, 0, 15, 12, 0);
const future = new Date(now.getTime() + 10 * 86_400_000);
const past = new Date(now.getTime() - 1 * 86_400_000);

describe("subscriptionState", () => {
  it("FREE tier is always free/active", () => {
    const s = subscriptionState({ planTier: "FREE", planActiveUntil: null, planIsTrial: false }, now);
    expect(s.status).toBe("FREE");
    expect(s.effectiveTier).toBe("FREE");
  });

  it("active paid plan grants its tier", () => {
    const s = subscriptionState({ planTier: "PRO", planActiveUntil: future, planIsTrial: false }, now);
    expect(s.status).toBe("ACTIVE");
    expect(s.effectiveTier).toBe("PRO");
    expect(s.daysLeft).toBe(10);
  });

  it("active trial reports TRIAL but grants the tier", () => {
    const s = subscriptionState({ planTier: "STARTER", planActiveUntil: future, planIsTrial: true }, now);
    expect(s.status).toBe("TRIAL");
    expect(s.effectiveTier).toBe("STARTER");
  });

  it("lapsed paid plan soft-downgrades to FREE limits", () => {
    const s = subscriptionState({ planTier: "PRO", planActiveUntil: past, planIsTrial: false }, now);
    expect(s.status).toBe("EXPIRED");
    expect(s.effectiveTier).toBe("FREE");
    expect(s.tier).toBe("PRO");
  });
});
