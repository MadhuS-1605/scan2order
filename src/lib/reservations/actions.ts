"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import { sendWhatsAppFreeform } from "@/lib/messaging/provider";
import { recordUsage } from "@/lib/usage";
import { slotBucketMs, capacityExceeded } from "@/lib/reservations/slots";
import { Prisma, type ReservationStatus } from "@prisma/client";

// Thrown inside the transaction below to abort the write without Prisma
// treating it as a DB-level error — caught by the caller and mapped to the
// same user-facing message as a real capacity conflict.
class SlotFullError extends Error {}

// Postgres SERIALIZATION FAILURE (SQLSTATE 40001), surfaced by Prisma as
// P2034 — "Transaction failed due to a write conflict." Two concurrent
// bookings racing for the same slot land here instead of both succeeding.
function isSerializationConflict(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
}

export async function createReservationAction(args: {
  slug: string;
  type: "RESERVATION" | "WAITLIST";
  customerName: string;
  customerPhone: string;
  partySize: number;
  reservedFor?: string; // ISO datetime, required for RESERVATION
  notes?: string;
}): Promise<{ ok: boolean; error?: string; mocked?: boolean; id?: string }> {
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

  const capacityPerSlot = restaurant.config?.reservationCapacityPerSlot ?? null;

  // Capacity check + insert run in one Serializable transaction — two guests
  // booking the same near-full slot at the same instant would otherwise both
  // read "capacity available" before either write lands (TOCTOU), jointly
  // overbooking it. Serializable makes Postgres abort one side with a
  // conflict instead; we treat that the same as "slot full."
  let reservation: Awaited<ReturnType<typeof prisma.reservation.create>>;
  try {
    reservation = await prisma.$transaction(
      async (tx) => {
        if (reservedFor && capacityPerSlot !== null) {
          const slotMinutes = restaurant.config?.reservationSlotMinutes ?? 30;
          const bucketStart = slotBucketMs(reservedFor, slotMinutes);
          const bucketEnd = bucketStart + slotMinutes * 60_000;
          const inSlot = await tx.reservation.findMany({
            where: {
              restaurantId: restaurant.id,
              type: "RESERVATION",
              status: { in: ["PENDING", "CONFIRMED"] },
              reservedFor: { gte: new Date(bucketStart), lt: new Date(bucketEnd) },
            },
            select: { partySize: true },
          });
          if (capacityExceeded(inSlot.map((r) => r.partySize), partySize, capacityPerSlot)) {
            throw new SlotFullError();
          }
        }
        return tx.reservation.create({
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
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    if (e instanceof SlotFullError || isSerializationConflict(e)) {
      return { ok: false, error: "That time is fully booked — please pick another slot." };
    }
    throw e;
  }

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
  const res = await sendWhatsAppFreeform(
    phone,
    `Hi ${name}, we've received your ${
      args.type === "WAITLIST" ? "waitlist request" : "reservation"
    } at ${restaurant.name}${when} for ${partySize}. We'll confirm shortly.`,
    restaurant.config?.whatsappFrom,
  );
  if (res.ok) await recordUsage(restaurant.id, "whatsapp");

  return { ok: true, mocked: res.mocked, id: reservation.id };
}

// Owner/manager sets (or clears) the per-slot capacity cap. Empty capacity
// input means uncapped.
export async function setReservationCapacityAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "settings")) return;
  const slotMinutes = Math.max(5, Math.min(240, Math.floor(Number(formData.get("slotMinutes")) || 30)));
  const raw = String(formData.get("capacityPerSlot") ?? "").trim();
  const capacityPerSlot = raw === "" ? null : Math.max(1, Math.floor(Number(raw)) || 1);
  await prisma.onboardingConfig.update({
    where: { restaurantId: session.restaurantId },
    data: { reservationSlotMinutes: slotMinutes, reservationCapacityPerSlot: capacityPerSlot },
  });
  revalidatePath("/admin/reservations");
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
    const res = await sendWhatsAppFreeform(
      reservation.customerPhone,
      `Good news ${reservation.customerName}! Your table at ${reservation.restaurant.name}${when} is confirmed. See you soon.`,
      reservation.restaurant.config?.whatsappFrom,
    );
    if (res.ok) await recordUsage(reservation.restaurantId, "whatsapp");
  }
}
