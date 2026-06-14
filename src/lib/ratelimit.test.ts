import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

// Deterministic by passing explicit `now`. Each test uses a unique key so the
// process-global window doesn't bleed across tests.
describe("rateLimit", () => {
  const cfg = { windowMs: 60_000, max: 6, minGapMs: 5_000 };

  it("allows the first hit", async () => {
    expect(await rateLimit("t:a", cfg, 1_000)).toBe(true);
  });

  it("blocks a second hit inside the min-gap (double-submit dedup)", async () => {
    expect(await rateLimit("t:b", cfg, 1_000)).toBe(true);
    expect(await rateLimit("t:b", cfg, 3_000)).toBe(false); // 2s < 5s gap
  });

  it("allows again once the min-gap has passed", async () => {
    expect(await rateLimit("t:c", cfg, 1_000)).toBe(true);
    expect(await rateLimit("t:c", cfg, 7_000)).toBe(true); // 6s > 5s gap
  });

  it("blocks after max hits within the window", async () => {
    // space hits 6s apart (clears min-gap) to reach the count cap
    const k = "t:d";
    for (let i = 0; i < 6; i++) {
      expect(await rateLimit(k, cfg, 1_000 + i * 6_000)).toBe(true);
    }
    expect(await rateLimit(k, cfg, 1_000 + 6 * 6_000)).toBe(false); // 7th in window
  });

  it("frees up after the window slides past", async () => {
    const k = "t:e";
    expect(await rateLimit(k, cfg, 1_000)).toBe(true);
    expect(await rateLimit(k, cfg, 1_000 + 61_000)).toBe(true); // old hit expired
  });
});
