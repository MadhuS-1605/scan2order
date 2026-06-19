import "server-only";
import { prisma } from "@/lib/db";
import { emitEvent } from "@/lib/realtime/bus";
import { recordAudit } from "@/lib/audit";
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

  // 1) Recover stuck online-payment intents: PENDING too long -> UNPAID so the
  //    diner/staff can retry. (We don't capture money without a verified
  //    signature, so reverting is safe; the order simply becomes payable again.)
  const stuck = await prisma.order.findMany({
    where: {
      restaurantId,
      paymentStatus: "PENDING",
      status: { not: "CANCELLED" },
      updatedAt: { lt: pendingCutoff },
    },
    select: { id: true },
  });
  if (stuck.length) {
    const ids = stuck.map((o) => o.id);
    await prisma.order.updateMany({
      where: { id: { in: ids } },
      data: { paymentStatus: "UNPAID" },
    });
    await prisma.payment.updateMany({
      where: { orderId: { in: ids }, status: "PENDING" },
      data: { status: "FAILED" },
    });
    for (const id of ids) emitEvent({ type: "order.updated", restaurantId, orderId: id });
  }

  // 2) Pay-first venues only: an order placed but never paid is abandoned —
  //    cancel it so the kitchen queue / floor stays clean.
  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { requirePrepayment: true },
  });
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
