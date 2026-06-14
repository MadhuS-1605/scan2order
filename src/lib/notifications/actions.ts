"use server";

import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { saveSubscription, removeSubscription, type WebPushSub } from "@/lib/push";

// Admin/kitchen device subscribes to its restaurant's order alerts.
export async function subscribeRestaurantPushAction(
  sub: WebPushSub,
): Promise<{ ok: boolean }> {
  const { restaurantId } = await requireOnboardedAdmin();
  await saveSubscription(sub, "RESTAURANT", { restaurantId });
  return { ok: true };
}

// A diner's device subscribes to status alerts for its own order.
export async function subscribeOrderPushAction(args: {
  orderId: string;
  qrToken: string;
  sub: WebPushSub;
}): Promise<{ ok: boolean; error?: string }> {
  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { table: true },
  });
  if (!order || order.table?.qrToken !== args.qrToken) {
    return { ok: false, error: "Order not found." };
  }
  await saveSubscription(args.sub, "CUSTOMER", {
    orderId: order.id,
    restaurantId: order.restaurantId,
  });
  return { ok: true };
}

export async function unsubscribePushAction(
  endpoint: string,
): Promise<{ ok: boolean }> {
  await removeSubscription(endpoint);
  return { ok: true };
}
