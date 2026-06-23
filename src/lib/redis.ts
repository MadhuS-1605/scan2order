import "server-only";
import Redis from "ioredis";

// Optional Redis. Enabled only when REDIS_URL is set — otherwise the realtime
// bus and rate limiter fall back to per-instance in-memory state (fine for a
// single instance; Redis is what makes them correct across instances/serverless).
// Two connections are kept: one for commands, one dedicated to pub/sub (a
// subscriber connection can't issue normal commands).

const url = process.env.REDIS_URL;

// Per-instance fallback is fine for a single replica, but on a multi-instance /
// serverless prod deploy it silently weakens rate limiting and breaks cross-node
// realtime. Warn loudly (once, at module load) so it's caught before scaling.
if (!url && process.env.NODE_ENV === "production") {
  console.warn(
    "[redis] REDIS_URL is not set — rate limiting and realtime use per-instance memory. Set REDIS_URL before running more than one replica.",
  );
}

const g = globalThis as unknown as {
  __sto_redis?: Redis | null;
  __sto_redis_sub?: Redis | null;
};

export function redisEnabled(): boolean {
  return Boolean(url);
}

function make(label: string): Redis | null {
  try {
    const c = new Redis(url as string, { maxRetriesPerRequest: 2 });
    c.on("error", (e) => console.error(`[redis] ${label} error`, e.message));
    return c;
  } catch (e) {
    console.error(`[redis] failed to create ${label} client`, e);
    return null;
  }
}

// Command connection (publish, eval, …).
export function getRedis(): Redis | null {
  if (!url) return null;
  if (g.__sto_redis === undefined) g.__sto_redis = make("command");
  return g.__sto_redis ?? null;
}

// Dedicated subscriber connection (SUBSCRIBE only).
export function getRedisSub(): Redis | null {
  if (!url) return null;
  if (g.__sto_redis_sub === undefined) g.__sto_redis_sub = make("subscriber");
  return g.__sto_redis_sub ?? null;
}
