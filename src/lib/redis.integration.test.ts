import { describe, it, expect, afterAll } from "vitest";
import Redis from "ioredis";

// Exercises the real Redis-backed paths (bus pub/sub + rate limiter) against a
// local Redis. Skipped automatically when no Redis is reachable, so CI without
// Redis still passes. Must set REDIS_URL before importing the lib modules.
const URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.REDIS_URL = URL;

let redisOk = false;
try {
  const probe = new Redis(URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
  await probe.connect();
  await probe.ping();
  await probe.quit();
  redisOk = true;
} catch {
  redisOk = false;
}

const timeout = (ms: number) =>
  new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms));

describe.skipIf(!redisOk)("Redis-backed realtime + rate limit", () => {
  afterAll(async () => {
    const { getRedis, getRedisSub } = await import("@/lib/redis");
    await getRedis()?.quit().catch(() => {});
    await getRedisSub()?.quit().catch(() => {});
  });

  it("delivers an emitted event to a subscriber via Redis pub/sub", async () => {
    const { emitEvent, subscribe } = await import("@/lib/realtime/bus");
    const got = new Promise<{ type: string }>((resolve) => {
      const off = subscribe("rtest-1", (e) => {
        off();
        resolve(e);
      });
    });
    // give SUBSCRIBE a moment to register before publishing
    await new Promise((r) => setTimeout(r, 150));
    emitEvent({ type: "ping", restaurantId: "rtest-1" });
    const e = (await Promise.race([got, timeout(2000)])) as { type: string };
    expect(e.type).toBe("ping");
  });

  it("enforces the count cap through Redis", async () => {
    const { rateLimit } = await import("@/lib/ratelimit");
    const key = `itest-${Date.now()}`;
    const cfg = { windowMs: 2000, max: 2, minGapMs: 0 };
    expect(await rateLimit(key, cfg)).toBe(true);
    expect(await rateLimit(key, cfg)).toBe(true);
    expect(await rateLimit(key, cfg)).toBe(false); // 3rd exceeds max=2
  });
});
