import "server-only";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/realtime/bus";
import { recordAudit } from "@/lib/audit";
import { notifyOps } from "@/lib/platform/alerts";
import { resolveRazorpayCreds, fetchCapturedPaymentForOrder } from "@/lib/payments/razorpay";
import { reconcilePaidByRazorpayOrder } from "@/lib/billing/actions";
import {
  pendingRecoverCutoff,
  prepaidAbandonCutoff,
} from "@/lib/orders/sweep-rules";

// Lazy housekeeping run when the admin orders board loads (cheap: a couple of
// scoped updateManys). Recovers stuck payment intents and cancels abandoned
// pay-first orders so they don't linger forever. Idempotent.
export async function sweepStaleOrders(restaurantId: string): Promise<void> {
  const now = new Date();
  const pendingCutoff = pendingRecoverCutoff(now);
  const abandonCutoff = prepaidAbandonCutoff(now);

  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { requirePrepayment: true, razorpayKeyId: true, razorpayKeySecret: true },
  });

  // 1) Recover stuck online-payment intents: PENDING too long. Before reverting
  //    to UNPAID, check Razorpay directly for a captured payment — a slow or
  //    dropped webhook must never be mistaken for a failed payment, or the
  //    diner gets prompted to pay again while the first payment still clears
  //    (a real double-charge with no automatic refund on our side).
  const stuck = await prisma.order.findMany({
    where: {
      restaurantId,
      paymentStatus: "PENDING",
      status: { not: "CANCELLED" },
      updatedAt: { lt: pendingCutoff },
    },
    select: { id: true, orderNumber: true },
  });
  if (stuck.length) {
    const creds = resolveRazorpayCreds(cfg ?? { razorpayKeyId: null, razorpayKeySecret: null });
    for (const o of stuck) {
      const payment = await prisma.payment.findFirst({
        where: { orderId: o.id, status: "PENDING" },
        select: { razorpayOrderId: true },
      });
      const razorpayOrderId = payment?.razorpayOrderId;
      const captured =
        creds && razorpayOrderId
          ? await fetchCapturedPaymentForOrder(creds, razorpayOrderId)
          : null;

      if (captured && razorpayOrderId) {
        await reconcilePaidByRazorpayOrder(razorpayOrderId, captured.id);
        emitEvent({ type: "order.updated", restaurantId, orderId: o.id });
        await prisma.paymentReconciliationEvent.create({
          data: {
            type: "LATE_WEBHOOK_RECOVERED",
            restaurantId,
            reference: razorpayOrderId,
            detail: `Order #${o.orderNumber}, payment ${captured.id}`,
          },
        });
        await notifyOps(
          "Late Razorpay webhook recovered",
          `Order #${o.orderNumber} (${restaurantId}) had a captured payment (${captured.id}) that our webhook never confirmed — reconciled by the sweep instead of being reverted to unpaid. Worth checking webhook delivery in the Razorpay dashboard.`,
        );
      } else {
        await prisma.order.update({ where: { id: o.id }, data: { paymentStatus: "UNPAID" } });
        await prisma.payment.updateMany({
          where: { orderId: o.id, status: "PENDING" },
          data: { status: "FAILED" },
        });
        emitEvent({ type: "order.updated", restaurantId, orderId: o.id });
      }
    }
  }

  // 2) Pay-first venues only: an order placed but never paid is abandoned —
  //    cancel it so the kitchen queue / floor stays clean.
  if (cfg?.requirePrepayment) {
    const abandoned = await prisma.order.findMany({
      where: {
        restaurantId,
        status: "PLACED",
        paymentStatus: { not: "PAID" },
        createdAt: { lt: abandonCutoff },
      },
      select: { id: true, orderNumber: true },
    });
    if (abandoned.length) {
      await prisma.order.updateMany({
        where: { id: { in: abandoned.map((o) => o.id) } },
        data: { status: "CANCELLED" },
      });
      for (const o of abandoned) {
        emitEvent({ type: "order.updated", restaurantId, orderId: o.id });
        await recordAudit(restaurantId, null, "order.abandoned_cancelled", `#${o.orderNumber}`);
      }
    }
  }
}
