import "server-only";
import { EventEmitter } from "node:events";
import { redisEnabled, getRedis, getRedisSub } from "@/lib/redis";

// Per-restaurant pub/sub for live updates to the customer, admin orders board,
// kitchen and floor via SSE. Delivery to SSE handlers always goes through a
// local EventEmitter. Without REDIS_URL that's the whole story (single instance
// only). With REDIS_URL, events are published to Redis and a per-instance
// subscriber re-emits them onto the local EventEmitter, so SSE clients on any
// instance receive events emitted on any other instance.

export type RealtimeEvent = {
  type:
    | "order.created"
    | "order.updated"
    | "order.status"
    | "service.request"
    | "reservation"
    | "attendance"
    | "ping";
  restaurantId: string;
  orderId?: string;
  status?: string;
  at: number;
};

const REDIS_CHANNEL = "sto:events";

const globalForBus = globalThis as unknown as {
  __sto_bus?: EventEmitter;
  __sto_bus_redis_wired?: boolean;
};

function bus(): EventEmitter {
  if (!globalForBus.__sto_bus) {
    const e = new EventEmitter();
    e.setMaxListeners(0); // many SSE subscribers
    globalForBus.__sto_bus = e;
  }
  return globalForBus.__sto_bus;
}

function channel(restaurantId: string): string {
  return `r:${restaurantId}`;
}

// Wire the Redis subscriber once per instance: incoming cross-instance events
// are re-emitted onto the local EventEmitter for delivery to SSE handlers.
function ensureRedisSubscriber(): void {
  if (!redisEnabled() || globalForBus.__sto_bus_redis_wired) return;
  const sub = getRedisSub();
  if (!sub) return;
  globalForBus.__sto_bus_redis_wired = true;
  sub.subscribe(REDIS_CHANNEL).catch((e) =>
    console.error("[bus] redis subscribe failed", e),
  );
  sub.on("message", (_ch, payload) => {
    try {
      const event = JSON.parse(payload) as RealtimeEvent;
      bus().emit(channel(event.restaurantId), event);
    } catch {
      // ignore malformed frames
    }
  });
}

export function emitEvent(event: Omit<RealtimeEvent, "at">): void {
  const full: RealtimeEvent = { ...event, at: Date.now() };
  const redis = redisEnabled() ? getRedis() : null;
  if (redis) {
    // Deliver via Redis — every instance (including this one, via its
    // subscriber) gets it. Fall back to a local emit if the publish fails.
    redis.publish(REDIS_CHANNEL, JSON.stringify(full)).catch((e) => {
      console.error("[bus] redis publish failed, emitting locally", e);
      bus().emit(channel(full.restaurantId), full);
    });
  } else {
    bus().emit(channel(full.restaurantId), full);
  }

  // Fan out order events to any configured outbound webhook (best-effort; lazy
  // import to avoid a circular dependency with the integrations layer). Fires
  // once, on the instance that emitted.
  if (full.type === "order.created" || full.type === "order.updated") {
    void import("@/lib/integrations/webhooks")
      .then((m) => m.dispatchWebhook(full.restaurantId, full.type, full.orderId))
      .catch((e) =>
        console.error("[webhook] dispatch failed", full.type, full.restaurantId, e),
      );
  }
}

export function subscribe(
  restaurantId: string,
  handler: (event: RealtimeEvent) => void,
): () => void {
  ensureRedisSubscriber();
  const ch = channel(restaurantId);
  bus().on(ch, handler);
  return () => bus().off(ch, handler);
}
