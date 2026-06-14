"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import type { ServiceRequestType } from "@prisma/client";

const TYPES: ServiceRequestType[] = [
  "CALL_WAITER",
  "WATER",
  "BILL",
  "CLEAN_TABLE",
  "OTHER",
];

const ALERT: Record<ServiceRequestType, string> = {
  CALL_WAITER: "Waiter requested",
  WATER: "Water requested",
  BILL: "Bill requested",
  CLEAN_TABLE: "Cleaning requested",
  OTHER: "Service requested",
};

export async function createServiceRequestAction(args: {
  qrToken: string;
  type: ServiceRequestType;
  note?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!TYPES.includes(args.type)) return { ok: false, error: "Invalid request." };

  const table = await prisma.restaurantTable.findUnique({
    where: { qrToken: args.qrToken },
    include: { restaurant: true },
  });
  if (!table || !table.isActive) return { ok: false, error: "Table not found." };

  // Avoid spam: collapse repeat open requests of the same type within 1 min.
  const recent = await prisma.serviceRequest.findFirst({
    where: {
      tableId: table.id,
      type: args.type,
      status: "OPEN",
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (!recent) {
    await prisma.serviceRequest.create({
      data: {
        restaurantId: table.restaurantId,
        tableId: table.id,
        type: args.type,
        note: args.note?.slice(0, 200) || null,
      },
    });
    emitEvent({ type: "service.request", restaurantId: table.restaurantId });
    await notifyRestaurant(table.restaurantId, {
      title: `${ALERT[args.type]} · ${table.label}`,
      body: args.note ?? "Tap to view on the orders board.",
      url: "/admin/orders",
      tag: `service-${table.id}`,
    });
  }
  return { ok: true };
}

export async function resolveServiceRequestAction(
  formData: FormData,
): Promise<void> {
  const { restaurantId } = await requireOnboardedAdmin();
  const id = String(formData.get("id"));
  await prisma.serviceRequest.updateMany({
    where: { id, restaurantId },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  emitEvent({ type: "service.request", restaurantId });
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
}
