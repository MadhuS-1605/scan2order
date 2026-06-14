"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin, requireAdminWithPermission } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { distanceMeters } from "@/lib/utils";
import { emitEvent } from "@/lib/realtime/bus";
import type { ActionState } from "@/lib/validation";

type Coords = { lat?: number; lng?: number };

function bump(restaurantId: string) {
  emitEvent({ type: "attendance", restaurantId });
  revalidatePath("/admin");
  revalidatePath("/admin/attendance");
}

// Verify the punch is within the configured geofence. Returns an error message
// to show the user, or null when the location is acceptable.
async function geofenceError(
  restaurantId: string,
  coords: Coords,
): Promise<string | null> {
  const config = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { latitude: true, longitude: true, geofenceRadiusM: true },
  });
  if (!config || config.latitude == null || config.longitude == null) {
    return "Your manager hasn't set the venue location yet — ask them to set it in Settings → Modules.";
  }
  if (coords.lat == null || coords.lng == null) {
    return "We couldn't read your location. Allow location access and try again.";
  }
  const d = distanceMeters(config.latitude, config.longitude, coords.lat, coords.lng);
  if (d > config.geofenceRadiusM) {
    return `You must be at the restaurant to do this (you're about ${d} m away).`;
  }
  return null;
}

// Self clock-in (geofenced).
export async function clockInAction(coords: Coords): Promise<ActionState> {
  const session = await requireOnboardedAdmin();
  const open = await prisma.staffAttendance.findFirst({
    where: { adminUserId: session.sub, clockOutAt: null },
  });
  if (open) return { error: "You're already clocked in." };

  const geo = await geofenceError(session.restaurantId, coords);
  if (geo) return { error: geo };

  await prisma.staffAttendance.create({
    data: {
      restaurantId: session.restaurantId,
      adminUserId: session.sub,
      clockInAt: new Date(),
      clockInLat: coords.lat,
      clockInLng: coords.lng,
      source: "SELF",
    },
  });
  bump(session.restaurantId);
  return { ok: true, message: "Clocked in" };
}

// Self clock-out (geofenced) — closes the current open punch.
export async function clockOutAction(coords: Coords): Promise<ActionState> {
  const session = await requireOnboardedAdmin();
  const open = await prisma.staffAttendance.findFirst({
    where: { adminUserId: session.sub, clockOutAt: null },
    orderBy: { clockInAt: "desc" },
  });
  if (!open) return { error: "You're not clocked in." };

  const geo = await geofenceError(session.restaurantId, coords);
  if (geo) return { error: geo };

  await prisma.staffAttendance.update({
    where: { id: open.id },
    data: { clockOutAt: new Date(), clockOutLat: coords.lat, clockOutLng: coords.lng },
  });
  bump(session.restaurantId);
  return { ok: true, message: "Clocked out" };
}

// Manager records a complete (or open) attendance entry for a staff member.
export async function markAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("attendance");
  const adminUserId = String(formData.get("adminUserId") ?? "");
  const inRaw = String(formData.get("clockInAt") ?? "");
  const outRaw = String(formData.get("clockOutAt") ?? "");

  const staff = await prisma.adminUser.findFirst({
    where: { id: adminUserId, restaurantId: session.restaurantId },
    select: { name: true },
  });
  if (!staff) return { error: "Select a team member." };
  if (!inRaw) return { error: "Clock-in time is required." };

  const clockInAt = new Date(inRaw);
  if (Number.isNaN(clockInAt.getTime())) return { error: "Invalid clock-in time." };
  let clockOutAt: Date | null = null;
  if (outRaw) {
    clockOutAt = new Date(outRaw);
    if (Number.isNaN(clockOutAt.getTime())) return { error: "Invalid clock-out time." };
    if (clockOutAt <= clockInAt) return { error: "Clock-out must be after clock-in." };
  }

  await prisma.staffAttendance.create({
    data: {
      restaurantId: session.restaurantId,
      adminUserId,
      clockInAt,
      clockOutAt,
      source: "MANAGER",
      markedById: session.sub,
      markedByName: session.name,
    },
  });
  await recordAudit(session.restaurantId, session, "attendance.marked", staff.name);
  bump(session.restaurantId);
  return { ok: true, message: `Attendance recorded for ${staff.name}` };
}

// Manager closes an open punch (defaults to now).
export async function setClockOutAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("attendance");
  const id = String(formData.get("id") ?? "");
  const outRaw = String(formData.get("clockOutAt") ?? "");
  const clockOutAt = outRaw ? new Date(outRaw) : new Date();
  if (Number.isNaN(clockOutAt.getTime())) return;
  const res = await prisma.staffAttendance.updateMany({
    where: { id, restaurantId: session.restaurantId, clockOutAt: null },
    data: { clockOutAt, markedById: session.sub, markedByName: session.name },
  });
  if (res.count > 0) {
    await recordAudit(session.restaurantId, session, "attendance.marked", "clock-out");
  }
  bump(session.restaurantId);
}
