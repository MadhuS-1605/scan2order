"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { emitEvent } from "@/lib/realtime/bus";
import { notifyRestaurant } from "@/lib/push";
import { recordAudit } from "@/lib/audit";
import { computeTotals, type GstMode } from "@/lib/pricing";
import { toNumber } from "@/lib/utils";
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

// Fire a confirmed banquet's pre-ordered menu to the kitchen as a real Order
// (so it produces KOTs and a bill). Idempotent: only converts once, only when
// CONFIRMED with items. The advance paid carries over as amountPaid.
export async function convertBanquetToKitchenAction(formData: FormData): Promise<void> {
  const session = await requireBanquetAdmin();
  const id = String(formData.get("id") ?? "");
  const booking = await prisma.banquetBooking.findFirst({
    where: { id, restaurantId: session.restaurantId },
    include: { items: true, restaurant: { include: { config: true } } },
  });
  if (!booking || !booking.restaurant.config) return;
  if (booking.status !== "CONFIRMED" || booking.items.length === 0 || booking.convertedOrderId) {
    return;
  }
  const config = booking.restaurant.config;
  const totals = computeTotals(
    booking.items.map((i) => ({ price: toNumber(i.priceSnapshot), quantity: i.quantity })),
    config.gstMode as GstMode,
    toNumber(config.gstPercentage),
  );
  const advance = toNumber(booking.advanceAmount);
  const fullyPaid = advance >= totals.total - 0.01;

  const order = await prisma.$transaction(async (tx) => {
    const r = await tx.restaurant.update({
      where: { id: session.restaurantId },
      data: { orderSeq: { increment: 1 } },
      select: { orderSeq: true },
    });
    const created = await tx.order.create({
      data: {
        restaurantId: session.restaurantId,
        orderNumber: r.orderSeq,
        status: "CONFIRMED",
        channel: "STAFF",
        createdById: session.sub,
        createdByName: session.name,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        notes: `Banquet · ${booking.eventType} · ${booking.guestCount} guests${
          booking.hall ? ` · ${booking.hall}` : ""
        }`,
        paymentStatus: fullyPaid ? "PAID" : "UNPAID",
        paymentMethod: advance > 0 ? "COUNTER" : null,
        amountPaid: advance,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        gstMode: config.gstMode,
        confirmedAt: new Date(),
        items: {
          create: booking.items.map((i) => ({
            menuItemId: i.menuItemId,
            nameSnapshot: i.nameSnapshot,
            priceSnapshot: i.priceSnapshot,
            quantity: i.quantity,
            lineTotal: toNumber(i.priceSnapshot) * i.quantity,
          })),
        },
      },
    });
    await tx.banquetBooking.update({
      where: { id: booking.id },
      data: { convertedOrderId: created.id },
    });
    return created;
  });

  emitEvent({ type: "order.created", restaurantId: session.restaurantId, orderId: order.id, status: "CONFIRMED" });
  await notifyRestaurant(session.restaurantId, {
    title: `Banquet order #${order.orderNumber}`,
    body: `${booking.eventType} · ${booking.guestCount} guests`,
    url: "/admin/kitchen",
    tag: "banquet-order",
  });
  await recordAudit(session.restaurantId, session, "banquet.converted", `#${order.orderNumber} · ${booking.eventType}`);
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
