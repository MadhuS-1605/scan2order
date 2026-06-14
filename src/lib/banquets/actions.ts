"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import { recordAudit } from "@/lib/audit";
import type { BanquetStatus } from "@prisma/client";

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Corporate",
  "Anniversary",
  "Get-together",
  "Other",
];

// --- Public: a guest submits a banquet / event enquiry ---
export async function createBanquetEnquiryAction(args: {
  slug: string;
  customerName: string;
  customerPhone: string;
  eventType: string;
  eventDate: string; // ISO date
  guestCount: number;
  notes?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = args.customerName.trim();
  const phone = args.customerPhone.trim();
  if (name.length < 2) return { ok: false, error: "Enter your name." };
  if (!/^\+?\d{7,15}$/.test(phone))
    return { ok: false, error: "Enter a valid mobile number." };
  const eventDate = new Date(args.eventDate);
  if (isNaN(eventDate.getTime()))
    return { ok: false, error: "Pick a valid event date." };
  if (eventDate.getTime() < Date.now() - 86_400_000)
    return { ok: false, error: "Pick a future date." };
  const guestCount = Math.max(1, Math.min(5000, Math.floor(args.guestCount) || 20));
  const eventType = EVENT_TYPES.includes(args.eventType) ? args.eventType : "Other";

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: args.slug },
    select: { id: true },
  });
  if (!restaurant) return { ok: false, error: "Venue not found." };

  await prisma.banquetBooking.create({
    data: {
      restaurantId: restaurant.id,
      customerName: name,
      customerPhone: phone,
      eventType,
      eventDate,
      guestCount,
      notes: args.notes?.slice(0, 500) || null,
    },
  });

  emitEvent({ type: "reservation", restaurantId: restaurant.id });
  await notifyRestaurant(restaurant.id, {
    title: `Event enquiry: ${eventType} (${guestCount} pax)`,
    body: `${name} · ${eventDate.toLocaleDateString("en-IN")}`,
    url: "/admin/banquets",
    tag: "banquet",
  });
  return { ok: true };
}

// --- Admin ---
async function requireBanquetAdmin() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "orders")) throw new Error("Not allowed");
  return session;
}

export async function createBanquetAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const name = String(formData.get("customerName") ?? "").trim();
  const phone = String(formData.get("customerPhone") ?? "").trim();
  const eventType = String(formData.get("eventType") ?? "Other");
  const eventDateRaw = String(formData.get("eventDate") ?? "");
  const guestCount = Number(formData.get("guestCount") ?? 20) || 20;
  const hall = String(formData.get("hall") ?? "").trim();
  const advance = Number(formData.get("advanceAmount") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "").trim();
  const eventDate = new Date(eventDateRaw);
  if (name.length < 2 || isNaN(eventDate.getTime())) return;

  const booking = await prisma.banquetBooking.create({
    data: {
      restaurantId: session.restaurantId,
      customerName: name,
      customerPhone: phone,
      eventType,
      eventDate,
      guestCount: Math.max(1, Math.floor(guestCount)),
      hall: hall || null,
      advanceAmount: Math.max(0, advance),
      status: "CONFIRMED",
      notes: notes || null,
    },
  });
  await recordAudit(session.restaurantId, session, "banquet.created", `${eventType} · ${name}`);
  revalidatePath("/admin/banquets");
  emitEvent({ type: "reservation", restaurantId: session.restaurantId });
  void booking;
}

export async function setBanquetStatusAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as BanquetStatus;
  const allowed: BanquetStatus[] = ["ENQUIRY", "CONFIRMED", "COMPLETED", "CANCELLED"];
  if (!allowed.includes(status)) return;
  await prisma.banquetBooking.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { status },
  });
  revalidatePath("/admin/banquets");
}

export async function addBanquetItemAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const bookingId = String(formData.get("bookingId") ?? "");
  const menuItemId = String(formData.get("menuItemId") ?? "");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1) || 1);

  const booking = await prisma.banquetBooking.findFirst({
    where: { id: bookingId, restaurantId: session.restaurantId },
    select: { id: true },
  });
  const item = await prisma.menuItem.findFirst({
    where: { id: menuItemId, restaurantId: session.restaurantId },
    select: { name: true, price: true },
  });
  if (!booking || !item) return;

  await prisma.banquetItem.create({
    data: {
      bookingId: booking.id,
      menuItemId,
      nameSnapshot: item.name,
      priceSnapshot: item.price,
      quantity,
    },
  });
  revalidatePath("/admin/banquets");
}

export async function removeBanquetItemAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const id = String(formData.get("id") ?? "");
  // Scope deletion to the admin's restaurant via the parent booking.
  await prisma.banquetItem.deleteMany({
    where: { id, booking: { restaurantId: session.restaurantId } },
  });
  revalidatePath("/admin/banquets");
}

export async function deleteBanquetAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const id = String(formData.get("id") ?? "");
  await prisma.banquetBooking.deleteMany({
    where: { id, restaurantId: session.restaurantId },
  });
  revalidatePath("/admin/banquets");
}
