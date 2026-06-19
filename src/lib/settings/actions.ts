"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
import { plan } from "@/lib/plan-limits";
import {
  profileSchema,
  settingsSchema,
  type ActionState,
} from "@/lib/validation";

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("settings");
  const { restaurantId } = session;
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name: d.name,
      type: d.type,
      phone: d.phone || null,
      email: d.email || null,
      addressLine: d.addressLine || null,
      city: d.city || null,
      state: d.state || null,
      postalCode: d.postalCode || null,
      fssaiNumber: d.fssaiNumber || null,
      logoUrl: d.logoUrl || null,
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  await recordAudit(restaurantId, session, "settings.profile");
  return { ok: true, message: "Profile updated" };
}

export async function updateOperationsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("settings");
  const { restaurantId } = session;
  const parsed = settingsSchema.safeParse({
    ...Object.fromEntries(formData),
    onlinePaymentEnabled: formData.get("onlinePaymentEnabled") === "on",
    counterPaymentEnabled: formData.get("counterPaymentEnabled") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  // Self-service venues are pay-first by definition — keep PAY_BEFORE +
  // prepayment on regardless of the form (the settings UI hides pay-after).
  const svc = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { serviceModel: true },
  });
  const selfService = svc?.serviceModel === "SELF_SERVICE";
  // Plan gate: only paid (or trial) tiers may take online payments.
  const limits = await plan(restaurantId);
  const onlineAllowed = limits.onlinePayments;
  const reviewUrl = String(formData.get("reviewUrl") ?? "").trim();
  const hhFrom = String(formData.get("happyHourFrom") ?? "").trim();
  const hhTo = String(formData.get("happyHourTo") ?? "").trim();
  const langs = new Set(["en", ...formData.getAll("languages").map(String)]);
  const printerHost = String(formData.get("kotPrinterHost") ?? "").trim();
  const printerPort = Number(formData.get("kotPrinterPort") ?? 9100) || 9100;
  const latRaw = String(formData.get("latitude") ?? "").trim();
  const lngRaw = String(formData.get("longitude") ?? "").trim();
  const lat = latRaw === "" ? null : Number(latRaw);
  const lng = lngRaw === "" ? null : Number(lngRaw);
  const radius = Math.max(
    20,
    Math.min(5000, Number(formData.get("geofenceRadiusM") ?? 150) || 150),
  );
  const orderRadius = Math.max(
    50,
    Math.min(5000, Number(formData.get("orderRadiusM") ?? 300) || 300),
  );
  await prisma.onboardingConfig.update({
    where: { restaurantId },
    data: {
      orderConfirmation: d.orderConfirmation,
      paymentTiming: selfService ? "PAY_BEFORE" : d.paymentTiming,
      requirePrepayment: selfService,
      onlinePaymentEnabled: onlineAllowed && d.onlinePaymentEnabled,
      counterPaymentEnabled: d.counterPaymentEnabled,
      gstMode: d.gstMode,
      gstNumber: d.gstNumber || null,
      gstPercentage: d.gstPercentage,
      reviewUrl: reviewUrl || null,
      happyHourEnabled: formData.get("happyHourEnabled") === "on",
      happyHourFrom: hhFrom || null,
      happyHourTo: hhTo || null,
      happyHourPercent: Math.max(
        0,
        Math.min(90, Number(formData.get("happyHourPercent") ?? 0) || 0),
      ),
      // Service hours + venue timezone (all time-of-day logic uses this tz).
      timezone: String(formData.get("timezone") ?? "").trim() || "Asia/Kolkata",
      openTime: String(formData.get("openTime") ?? "").trim() || null,
      closeTime: String(formData.get("closeTime") ?? "").trim() || null,
      orderingPaused: formData.get("orderingPaused") === "on",
      billFooterMessage: String(formData.get("billFooterMessage") ?? "").trim() || null,
      defaultPrepMinutes: Math.max(
        0,
        Math.min(180, Number(formData.get("defaultPrepMinutes") ?? 15) || 15),
      ),
      minOrderAmount: Math.max(0, Math.floor(Number(formData.get("minOrderAmount") ?? 0) || 0)),
      pickupEnabled: formData.get("pickupEnabled") === "on",
      deliveryEnabled: formData.get("deliveryEnabled") === "on",
      languages: [...langs].join(","),
      kotPrinterHost: printerHost || null,
      kotPrinterPort: Math.max(1, Math.min(65535, printerPort)),
      featureReservations: formData.get("featureReservations") === "on",
      featureRooms: formData.get("featureRooms") === "on",
      featureBanquets: formData.get("featureBanquets") === "on",
      featureBar: formData.get("featureBar") === "on",
      featureAttendance: formData.get("featureAttendance") === "on",
      requireDinerLocation: formData.get("requireDinerLocation") === "on",
      latitude: lat != null && !Number.isNaN(lat) ? lat : null,
      longitude: lng != null && !Number.isNaN(lng) ? lng : null,
      geofenceRadiusM: radius,
      orderRadiusM: orderRadius,
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  await recordAudit(restaurantId, session, "settings.operations");
  return { ok: true, message: "Operations & tax settings saved" };
}

export async function updatePaymentCredsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("settings");
  const { restaurantId } = session;
  const razorpayKeyId = String(formData.get("razorpayKeyId") ?? "").trim();
  const razorpayKeySecret = String(
    formData.get("razorpayKeySecret") ?? "",
  ).trim();
  const whatsappFrom = String(formData.get("whatsappFrom") ?? "").trim();
  const upiId = String(formData.get("upiId") ?? "").trim();
  const upiName = String(formData.get("upiName") ?? "").trim();

  await prisma.onboardingConfig.update({
    where: { restaurantId },
    data: {
      razorpayKeyId: razorpayKeyId || null,
      // Keep existing secret if the field is left blank (masked on the form).
      ...(razorpayKeySecret ? { razorpayKeySecret } : {}),
      whatsappFrom: whatsappFrom || null,
      upiId: upiId || null,
      upiName: upiName || null,
    },
  });
  revalidatePath("/admin/settings");
  await recordAudit(restaurantId, session, "settings.payment");
  return { ok: true, message: "Payment & messaging settings saved" };
}
