import "server-only";
import { redisEnabled, getRedis } from "@/lib/redis";

// Sliding-window rate limiter. Uses Redis (atomic, cross-instance) when
// REDIS_URL is set, otherwise an in-memory per-instance map. Returns true if the
// action is allowed for `key`, false if it exceeds either:
//  - `minGapMs`: minimum gap since the last hit (double-submit dedup), or
//  - `max` hits within `windowMs`.
// A successful check records the hit.

const globalForRl = globalThis as unknown as {
  __sto_rl?: Map<string, number[]>;
};

function store(): Map<string, number[]> {
  if (!globalForRl.__sto_rl) globalForRl.__sto_rl = new Map();
  return globalForRl.__sto_rl;
}

// Atomic check-and-record over a Redis sorted set of hit timestamps.
const LUA = `
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local gap = tonumber(ARGV[4])
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)
if gap > 0 then
  local last = redis.call('ZRANGE', KEYS[1], -1, -1, 'WITHSCORES')
  if #last > 0 and (now - tonumber(last[2])) < gap then return 0 end
end
if redis.call('ZCARD', KEYS[1]) >= max then return 0 end
redis.call('ZADD', KEYS[1], now, tostring(now) .. ':' .. tostring(math.random()))
redis.call('PEXPIRE', KEYS[1], window)
return 1
`;

type Opts = { windowMs: number; max: number; minGapMs?: number };

export async function rateLimit(
  key: string,
  { windowMs, max, minGapMs }: Opts,
  now: number = Date.now(),
): Promise<boolean> {
  const redis = redisEnabled() ? getRedis() : null;
  if (redis) {
    try {
      const res = await redis.eval(
        LUA,
        1,
        `rl:${key}`,
        String(Date.now()),
        String(windowMs),
        String(max),
        String(minGapMs ?? 0),
      );
      return res === 1;
    } catch (e) {
      // Fail open — a Redis hiccup shouldn't block legitimate orders.
      console.error("[ratelimit] redis error, allowing", e);
      return true;
    }
  }

  // In-memory fallback (single instance).
  const m = store();
  const hits = (m.get(key) ?? []).filter((t) => now - t < windowMs);
  if (minGapMs && hits.length && now - hits[hits.length - 1] < minGapMs) {
    m.set(key, hits);
    return false;
  }
  if (hits.length >= max) {
    m.set(key, hits);
    return false;
  }
  hits.push(now);
  m.set(key, hits);
  return true;
}
