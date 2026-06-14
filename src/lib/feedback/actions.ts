"use server";

import { prisma } from "@/lib/db";

export async function submitFeedbackAction(args: {
  orderId: string;
  qrToken: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: boolean; error?: string; reviewUrl?: string | null }> {
  const rating = Math.round(args.rating);
  if (rating < 1 || rating > 5) return { ok: false, error: "Pick a rating." };

  const order = await prisma.order.findUnique({
    where: { id: args.orderId },
    include: { table: true, restaurant: { include: { config: true } } },
  });
  if (!order || order.table?.qrToken !== args.qrToken || !order.restaurant.config) {
    return { ok: false, error: "Order not found." };
  }

  await prisma.feedback.upsert({
    where: { orderId: order.id },
    create: {
      restaurantId: order.restaurantId,
      orderId: order.id,
      customerId: order.customerId,
      rating,
      comment: args.comment?.slice(0, 500) || null,
    },
    update: {
      rating,
      comment: args.comment?.slice(0, 500) || null,
    },
  });

  // Nudge happy diners to leave a public review.
  const reviewUrl =
    rating >= 4 ? order.restaurant.config.reviewUrl ?? null : null;
  return { ok: true, reviewUrl };
}
