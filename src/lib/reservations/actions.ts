"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import { sendWhatsApp } from "@/lib/messaging/provider";
import { recordUsage } from "@/lib/usage";
import type { ReservationStatus } from "@prisma/client";

export async function createReservationAction(args: {
  slug: string;
  type: "RESERVATION" | "WAITLIST";
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedFor?: string; // ISO datetime, required for RESERVATION
  notes?: string;
}): Promise<{ ok: boolean; error?: string; mocked?: boolean }> {
  const name = args.customerName.trim();
  const phone = args.customerPhone.trim();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  if (!/^\+?\d{7,15}$/.test(phone))
    return { ok: false, error: "Enter a valid mobile number." };
  const partySize = Math.max(1, Math.min(50, Math.floor(args.partySize) || 2));

  let reservedFor: Date | null = null;
  if (args.type === "RESERVATION") {
    if (!args.reservedFor) return { ok: false, error: "Pick a date and time." };
    reservedFor = new Date(args.reservedFor);
    if (isNaN(reservedFor.getTime()))
      return { ok: false, error: "Invalid date/time." };
    if (reservedFor.getTime() < Date.now() - 60_000)
      return { ok: false, error: "Pick a future time." };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: args.slug },
    include: { config: true },
  });
  if (!restaurant) return { ok: false, error: "Restaurant not found." };

  await prisma.reservation.create({
    data: {
      restaurantId: restaurant.id,
      type: args.type,
      customerName: name,
      customerPhone: phone,
      partySize,
      reservedFor,
      notes: args.notes?.slice(0, 300) || null,
    },
  });

  emitEvent({ type: "reservation", restaurantId: restaurant.id });
  await notifyRestaurant(restaurant.id, {
    title:
      args.type === "WAITLIST"
        ? `Waitlist: ${name} (${partySize})`
        : `New reservation: ${name} (${partySize})`,
    body: reservedFor
      ? reservedFor.toLocaleString("en-IN")
      : "Waiting now",
    url: "/admin/reservations",
    tag: "reservation",
  });

  const when = reservedFor
    ? ` for ${reservedFor.toLocaleString("en-IN")}`
    : "";
  const res = await sendWhatsApp(
    phone,
    `Hi ${name}, we've received your ${
      args.type === "WAITLIST" ? "waitlist request" : "reservation"
    } at ${restaurant.name}${when} for ${partySize}. We'll confirm shortly.`,
    restaurant.config?.whatsappFrom,
  );
  if (res.ok) await recordUsage(restaurant.id, "whatsapp");

  return { ok: true, mocked: res.mocked };
}

const VALID: ReservationStatus[] = [
  "PENDING",
  "CONFIRMED",
  "SEATED",
  "CANCELLED",
  "NO_SHOW",
];

export async function setReservationStatusAction(
  formData: FormData,
): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "orders")) return;
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as ReservationStatus;
  if (!VALID.includes(status)) return;

  const reservation = await prisma.reservation.findFirst({
    where: { id, restaurantId: session.restaurantId },
    include: { restaurant: { include: { config: true } } },
  });
  if (!reservation) return;

  await prisma.reservation.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { status },
  });
  emitEvent({ type: "reservation", restaurantId: session.restaurantId });
  revalidatePath("/admin/reservations");

  if (status === "CONFIRMED") {
    const when = reservation.reservedFor
      ? ` for ${reservation.reservedFor.toLocaleString("en-IN")}`
      : "";
    const res = await sendWhatsApp(
      reservation.customerPhone,
      `Good news ${reservation.customerName}! Your table at ${reservation.restaurant.name}${when} is confirmed. See you soon.`,
      reservation.restaurant.config?.whatsappFrom,
    );
    if (res.ok) await recordUsage(reservation.restaurantId, "whatsapp");
  }
}
