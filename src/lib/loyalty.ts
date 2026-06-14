import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

// 1 loyalty point per ₹10 spent (configurable later per restaurant).
export const POINTS_PER_CURRENCY = 0.1;

export function pointsForAmount(amount: number): number {
  return Math.floor(amount * POINTS_PER_CURRENCY);
}

// Credits loyalty points to the linked customer once an order is fully paid.
// Idempotent via Order.pointsAwarded, so it's safe to call from the payment
// settle paths and from the customer-link (WhatsApp bill) path.
export async function awardPointsForOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      paymentStatus: true,
      pointsAwarded: true,
      totalAmount: true,
    },
  });
  if (
    !order ||
    order.pointsAwarded ||
    !order.customerId ||
    order.paymentStatus !== "PAID"
  ) {
    return;
  }
  const points = pointsForAmount(toNumber(order.totalAmount));
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { pointsAwarded: true },
    }),
    ...(points > 0
      ? [
          prisma.customer.update({
            where: { id: order.customerId },
            data: { loyaltyPoints: { increment: points } },
          }),
        ]
      : []),
  ]);
}
