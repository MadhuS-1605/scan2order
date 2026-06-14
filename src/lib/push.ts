import "server-only";
import webpush from "web-push";
import { prisma } from "@/lib/db";
import type { PushRole } from "@prisma/client";

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export function pushEnabled(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export type WebPushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function saveSubscription(
  sub: WebPushSub,
  role: PushRole,
  scope: { restaurantId?: string; orderId?: string },
): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      role,
      restaurantId: scope.restaurantId ?? null,
      orderId: scope.orderId ?? null,
    },
    update: {
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      role,
      restaurantId: scope.restaurantId ?? null,
      orderId: scope.orderId ?? null,
    },
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function deliver(subs: SubRow[], payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || subs.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err: unknown) {
        // Prune expired / unsubscribed endpoints.
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    }),
  );
}

// Notify all of a restaurant's admin/kitchen devices (e.g. a new order).
export async function notifyRestaurant(
  restaurantId: string,
  payload: PushPayload,
): Promise<void> {
  if (!pushEnabled()) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { restaurantId, role: "RESTAURANT" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await deliver(subs, payload);
}

// Notify the diner's device(s) for a specific order (e.g. order ready).
export async function notifyOrderCustomer(
  orderId: string,
  payload: PushPayload,
): Promise<void> {
  if (!pushEnabled()) return;
  const subs = await prisma.pushSubscription.findMany({
    where: { orderId, role: "CUSTOMER" },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  await deliver(subs, payload);
}
