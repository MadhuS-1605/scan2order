"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { awardPointsForOrder } from "@/lib/loyalty";
import { recordAudit } from "@/lib/audit";
import { toNumber } from "@/lib/utils";
import { round2 as r2 } from "@/lib/pricing";

// Front-desk checkout: settle every open room-charge for a room in one go.
export async function settleRoomAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "orders")) return;
  const tableId = String(formData.get("tableId") ?? "");

  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: session.restaurantId, kind: "ROOM" },
    select: { id: true, label: true },
  });
  if (!table) return;

  const open = await prisma.order.findMany({
    where: {
      restaurantId: session.restaurantId,
      tableId: table.id,
      paymentMethod: "ROOM",
      paymentStatus: "PENDING",
    },
  });

  let settledTotal = 0;
  for (const o of open) {
    const payable = r2(
      Math.max(0, toNumber(o.totalAmount) - toNumber(o.discountAmount)) +
        toNumber(o.tipAmount),
    );
    await prisma.order.update({
      where: { id: o.id },
      data: { paymentStatus: "PAID", amountPaid: payable },
    });
    settledTotal += payable;
    await awardPointsForOrder(o.id);
    emitEvent({
      type: "order.updated",
      restaurantId: session.restaurantId,
      orderId: o.id,
    });
  }

  if (open.length > 0) {
    await recordAudit(
      session.restaurantId,
      session,
      "room.checkout",
      `Room ${table.label} · ${open.length} order(s) · ₹${settledTotal}`,
    );
  }
  revalidatePath("/admin/rooms");
}
