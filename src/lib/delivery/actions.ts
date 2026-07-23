"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { emitEvent } from "@/lib/realtime/bus";
import type { DeliveryStatus } from "@prisma/client";

function revalidate() {
  revalidatePath("/admin/delivery");
}

export async function createRiderAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.deliveryRider.create({
    data: {
      restaurantId: session.restaurantId,
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
    },
  });
  revalidate();
}

export async function deactivateRiderAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  const id = String(formData.get("id"));
  await prisma.deliveryRider.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { isActive: false },
  });
  revalidate();
}

export async function assignRiderAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const orderId = String(formData.get("orderId"));
  const riderId = String(formData.get("riderId") ?? "") || null;
  const rider = riderId
    ? await prisma.deliveryRider.findFirst({ where: { id: riderId, restaurantId: session.restaurantId } })
    : null;
  if (riderId && !rider) return;

  await prisma.order.updateMany({
    where: { id: orderId, restaurantId: session.restaurantId, fulfillment: "DELIVERY" },
    data: {
      deliveryRiderId: riderId,
      deliveryStatus: riderId ? "ASSIGNED" : "UNASSIGNED",
    },
  });
  emitEvent({ type: "order.updated", restaurantId: session.restaurantId, orderId });
  revalidate();
}

const NEXT: Record<string, DeliveryStatus> = {
  ASSIGNED: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
};

export async function advanceDeliveryStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const orderId = String(formData.get("orderId"));
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: session.restaurantId, fulfillment: "DELIVERY" },
    select: { deliveryStatus: true },
  });
  const next = order?.deliveryStatus ? NEXT[order.deliveryStatus] : undefined;
  if (!next) return;

  await prisma.order.update({
    where: { id: orderId },
    data: {
      deliveryStatus: next,
      ...(next === "DELIVERED" ? { status: "COMPLETED" } : {}),
    },
  });
  emitEvent({ type: "order.updated", restaurantId: session.restaurantId, orderId });
  revalidate();
}
