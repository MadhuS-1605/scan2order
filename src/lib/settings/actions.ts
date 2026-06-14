"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { recordAudit } from "@/lib/audit";
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
      paymentTiming: d.paymentTiming,
      onlinePaymentEnabled: d.onlinePaymentEnabled,
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
