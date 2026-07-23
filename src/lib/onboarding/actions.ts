"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { newQrToken } from "@/lib/qr";
import {
  requireAdmin,
  requireOnboardedAdmin,
  requireAdminWithPermission,
} from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { slugify, escapeHtml } from "@/lib/utils";
import { validateSubdomain } from "@/lib/subdomain";
import { ensureSubdomain, syncSubdomain } from "@/lib/cloudflare";
import { notifyOps } from "@/lib/platform/alerts";
import { sendEmail } from "@/lib/messaging/provider";
import { generateOnboardingSummaryPdf } from "@/lib/onboarding/summary-pdf";
import { reportError } from "@/lib/observability";
import { trialDaysFor } from "@/lib/plan-settings";
import { tableQuotaReached, menuItemQuotaReached } from "@/lib/plan-limits";
import { STEPS, type Step } from "@/lib/onboarding/steps";
import { verifyGstin, type GstVerifyResult } from "@/lib/gst";
import {
  profileSchema,
  settingsSchema,
  categorySchema,
  menuItemSchema,
  tableSchema,
  bulkTableSchema,
  type ActionState,
} from "@/lib/validation";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "restaurant";
  let slug = root;
  let n = 1;
  while (await prisma.restaurant.findUnique({ where: { slug } })) {
    slug = `${root}-${n++}`;
  }
  return slug;
}

// Step 0 — create the restaurant + config, link the owner, advance to menu.
export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  // Validate the chosen username (subdomain).
  const subInput = String(formData.get("subdomain") ?? "");
  const sub = validateSubdomain(subInput);
  if (!sub.ok) return { error: `Username: ${sub.error}` };
  const subTaken = await prisma.restaurant.findFirst({
    where: { subdomain: sub.value, NOT: { id: session.restaurantId ?? "" } },
    select: { id: true },
  });
  if (subTaken) return { error: "That username is already taken." };

  // Fast food (QSR) is self-serve by definition, regardless of the toggle.
  const selfService = data.serviceModel === "SELF_SERVICE" || data.type === "QSR";
  // Self-service venues have no tables — guests order at a single QR, prepay,
  // and pick up by number. Force the matching service behaviour; the owner can
  // still tweak payment methods/GST in Settings.
  const serviceDefaults = selfService
    ? {
        serviceModel: "SELF_SERVICE" as const,
        requirePrepayment: true,
        paymentTiming: "PAY_BEFORE" as const,
        onlinePaymentEnabled: true,
        // location checks make no sense for takeaway/pickup
        requireDinerLocation: false,
      }
    : { serviceModel: "TABLE_SERVICE" as const };

  if (session.restaurantId) {
    // Editing an existing profile mid-onboarding.
    const prev = await prisma.restaurant.findUnique({
      where: { id: session.restaurantId },
      select: { subdomain: true },
    });
    await prisma.restaurant.update({
      where: { id: session.restaurantId },
      data: {
        name: data.name,
        type: data.type,
        subdomain: sub.value,
        phone: data.phone || null,
        email: data.email || null,
        addressLine: data.addressLine || null,
        city: data.city || null,
        state: data.state || null,
        postalCode: data.postalCode || null,
        fssaiNumber: data.fssaiNumber || null,
        logoUrl: data.logoUrl || null,
        config: { update: serviceDefaults },
      },
    });
    if (selfService) await ensureCounterTable(session.restaurantId);
    // Reconcile the tenant's Cloudflare DNS record (drops the old name on rename).
    await syncSubdomain(prev?.subdomain, sub.value);
    await advanceStep(session.restaurantId, "menu");
    redirect("/onboarding");
  }

  // Seed sensible module defaults from the venue type; the owner refines these
  // on the onboarding "Features" step and in Settings.
  const t = data.type;
  // Bakeries are counter/takeaway-first by nature, same as cloud kitchens for
  // pickup/delivery defaults — but (unlike cloud kitchens) still a physical
  // venue diners visit, so requireDinerLocation stays on.
  const counterFirst = t === "CLOUD_KITCHEN" || t === "BAKERY";
  const featureDefaults = {
    featureReservations: t !== "CLOUD_KITCHEN" && t !== "QSR" && t !== "BAKERY",
    featureRooms: t === "HOTEL",
    featureBanquets: t === "HOTEL",
    featureBar: t === "BAR",
    // Dine-in venues require diners to be on-site to order (anti-fake-order);
    // cloud kitchens take remote orders, so it's off there.
    requireDinerLocation: t !== "CLOUD_KITCHEN",
    // Cloud kitchens and bakeries are takeaway/delivery by default.
    pickupEnabled: counterFirst,
    deliveryEnabled: counterFirst,
  };

  const restaurant = await prisma.restaurant.create({
    data: {
      name: data.name,
      type: data.type,
      slug: await uniqueSlug(data.name),
      subdomain: sub.value,
      phone: data.phone || null,
      email: data.email || null,
      addressLine: data.addressLine || null,
      city: data.city || null,
      state: data.state || null,
      postalCode: data.postalCode || null,
      fssaiNumber: data.fssaiNumber || null,
      logoUrl: data.logoUrl || null,
      // Start a full-feature trial on Starter (operator-configurable length).
      planTier: "STARTER",
      planIsTrial: true,
      planActiveUntil: new Date(Date.now() + (await trialDaysFor("STARTER")) * 86_400_000),
      config: { create: { onboardingStep: 1, ...featureDefaults, ...serviceDefaults } },
    },
  });
  if (selfService) await ensureCounterTable(restaurant.id);

  // Alert the operator team about the new venue (fail-soft, no-op if unset).
  await notifyOps(
    "New venue signed up",
    `${data.name} (${data.type})\nUsername: ${sub.value}\nCity: ${data.city || "—"}`,
  );

  // Create the tenant's subdomain DNS record (no-op if Cloudflare is unconfigured).
  await ensureSubdomain(sub.value);

  await prisma.adminUser.update({
    where: { id: session.sub },
    data: { restaurantId: restaurant.id },
  });

  // Re-issue the session so it carries the new restaurantId.
  await createSession({ ...session, restaurantId: restaurant.id });

  redirect("/onboarding");
}

// A self-service venue needs exactly one ordering/pickup point so the existing
// QR + diner flow works unchanged. Idempotent — one COUNTER table per venue.
async function ensureCounterTable(restaurantId: string): Promise<void> {
  const existing = await prisma.restaurantTable.findFirst({
    where: { restaurantId, kind: "COUNTER" },
    select: { id: true },
  });
  if (!existing) {
    await prisma.restaurantTable.create({
      data: { restaurantId, label: "Counter", kind: "COUNTER", seats: 0, qrToken: newQrToken() },
    });
  }
}

async function advanceStep(
  restaurantId: string,
  to: Step,
): Promise<void> {
  await prisma.onboardingConfig.update({
    where: { restaurantId },
    data: { onboardingStep: STEPS.indexOf(to) },
  });
}

// Generic step navigation (Back / skip).
export async function gotoStepAction(step: Step) {
  const session = await requireOnboardedAdmin();
  await advanceStep(session.restaurantId, step);
  revalidatePath("/onboarding");
}

// Step 1 — menu: add a category.
export async function addCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("menu");
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const count = await prisma.menuCategory.count({
    where: { restaurantId: session.restaurantId },
  });
  await prisma.menuCategory.create({
    data: {
      restaurantId: session.restaurantId,
      name: parsed.data.name,
      icon: parsed.data.icon || null,
      station: parsed.data.station,
      sortOrder: count,
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/menu");
  return { ok: true };
}

// Step 1 — menu: add an item.
export async function addMenuItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("menu");
  if (await menuItemQuotaReached(session.restaurantId)) {
    return { error: "You've reached your plan's menu item limit. Upgrade your plan to add more." };
  }
  const parsed = menuItemSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    price: formData.get("price"),
    categoryId: formData.get("categoryId"),
    imageUrl: formData.get("imageUrl"),
    availableFrom: formData.get("availableFrom"),
    availableTo: formData.get("availableTo"),
    // Unchecked checkboxes are absent from FormData -> coerce explicitly.
    isVeg: formData.get("isVeg") === "true",
    isVegan: formData.get("isVegan") === "true",
    isJain: formData.get("isJain") === "true",
    isSpicy: formData.get("isSpicy") === "true",
    isGlutenFree: formData.get("isGlutenFree") === "true",
    isAvailable: formData.get("isAvailable") === "true",
    isSpecialOfDay: formData.get("isSpecialOfDay") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  // Only accept a category that belongs to this tenant.
  const categoryId = d.categoryId
    ? (await prisma.menuCategory.findFirst({ where: { id: d.categoryId, restaurantId: session.restaurantId }, select: { id: true } }))?.id ?? null
    : null;
  // Append new items after existing ones in the same category (drives reorder).
  const sortOrder = await prisma.menuItem.count({
    where: { restaurantId: session.restaurantId, categoryId },
  });
  await prisma.menuItem.create({
    data: {
      restaurantId: session.restaurantId,
      categoryId,
      name: d.name,
      description: d.description || null,
      price: d.price,
      imageUrl: d.imageUrl || null,
      isVeg: d.isVeg,
      isVegan: d.isVegan ?? false,
      isJain: d.isJain ?? false,
      isSpicy: d.isSpicy ?? false,
      isGlutenFree: d.isGlutenFree ?? false,
      isAvailable: d.isAvailable,
      isSpecialOfDay: d.isSpecialOfDay,
      availableFrom: d.availableFrom || null,
      availableTo: d.availableTo || null,
      sortOrder,
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/menu");
  return { ok: true };
}

export async function deleteMenuItemAction(formData: FormData) {
  const session = await requireAdminWithPermission("menu");
  const id = String(formData.get("id"));
  await prisma.menuItem.deleteMany({
    where: { id, restaurantId: session.restaurantId },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/menu");
}

// Look up a GSTIN against the GSTN and return the registered business name, so
// the Settings step can auto-fill it instead of trusting typed input. Returns a
// structured result (called imperatively from the client, not via a form).
export async function verifyGstinAction(
  gstin: string,
): Promise<GstVerifyResult> {
  await requireAdminWithPermission("settings");
  return verifyGstin(gstin);
}

// Step 2 — settings (order confirmation, payment, GST).
export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("settings");
  const raw = Object.fromEntries(formData);
  const parsed = settingsSchema.safeParse({
    ...raw,
    onlinePaymentEnabled: formData.get("onlinePaymentEnabled") === "on",
    counterPaymentEnabled: formData.get("counterPaymentEnabled") === "on",
    // Explicit boolean: coercing the "true"/"false" string would treat both as
    // truthy (any non-empty string is true under z.coerce.boolean()).
    gstVerified: formData.get("gstVerified") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  // Self-service venues are pay-first by definition: keep PAY_BEFORE + prepayment
  // on regardless of the form (the settings UI hides the pay-after option there).
  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId: session.restaurantId },
    select: { serviceModel: true },
  });
  const selfService = cfg?.serviceModel === "SELF_SERVICE";
  await prisma.onboardingConfig.update({
    where: { restaurantId: session.restaurantId },
    data: {
      orderConfirmation: d.orderConfirmation,
      paymentTiming: selfService ? "PAY_BEFORE" : d.paymentTiming,
      requirePrepayment: selfService,
      onlinePaymentEnabled: d.onlinePaymentEnabled,
      counterPaymentEnabled: d.counterPaymentEnabled,
      gstMode: d.gstMode,
      gstNumber: d.gstMode === "NONE" ? null : d.gstNumber || null,
      // The legal name + verified flag are only meaningful for a real GSTIN;
      // clear them when GST is off or no number is set.
      gstLegalName:
        d.gstMode === "NONE" || !d.gstNumber ? null : d.gstLegalName || null,
      gstVerified:
        d.gstMode !== "NONE" && Boolean(d.gstNumber) && Boolean(d.gstVerified),
      gstPercentage: d.gstPercentage,
      onboardingStep: STEPS.indexOf("tables"),
    },
  });
  redirect("/onboarding");
}

// Step 3 — tables (QR generated from the auto cuid token).
export async function addTableAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("tables");
  const parsed = tableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (await tableQuotaReached(session.restaurantId)) {
    return { error: "You've reached your plan's table limit. Upgrade your plan to add more." };
  }
  await prisma.restaurantTable.create({
    data: {
      restaurantId: session.restaurantId,
      label: parsed.data.label,
      seats: parsed.data.seats,
      kind: parsed.data.kind,
      qrToken: newQrToken(),
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/tables");
  return { ok: true };
}

// Generates a range of tables in one go (e.g. T1..T20) — a busy venue
// shouldn't have to submit the one-table form 20 times during onboarding.
export async function addTablesBulkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdminWithPermission("tables");
  const parsed = bulkTableSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { prefix, startAt, count, seats, kind } = parsed.data;

  let created = 0;
  for (let i = 0; i < count; i++) {
    if (await tableQuotaReached(session.restaurantId)) break;
    await prisma.restaurantTable.create({
      data: {
        restaurantId: session.restaurantId,
        label: `${prefix}${startAt + i}`,
        seats,
        kind,
        qrToken: newQrToken(),
      },
    });
    created++;
  }
  revalidatePath("/onboarding");
  revalidatePath("/admin/tables");
  if (created === 0) {
    return { error: "You've reached your plan's table limit. Upgrade your plan to add more." };
  }
  return {
    ok: true,
    message:
      created === 1
        ? `Added ${prefix}${startAt}.`
        : `Added ${created} tables (${prefix}${startAt}–${prefix}${startAt + created - 1}).`,
  };
}

export async function deleteTableAction(formData: FormData) {
  const session = await requireAdminWithPermission("tables");
  const id = String(formData.get("id"));
  await prisma.restaurantTable.deleteMany({
    where: { id, restaurantId: session.restaurantId },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/tables");
}

// Fixed internal recipient for the onboarding-summary PDF below — not an ops
// alert (those go to OPS_ALERT_EMAIL), just a standing request for a copy of
// every completed signup.
const ONBOARDING_SUMMARY_EMAIL = "astechlabs5@gmail.com";

// Finish onboarding.
export async function completeOnboardingAction() {
  const session = await requireOnboardedAdmin();
  await prisma.onboardingConfig.update({
    where: { restaurantId: session.restaurantId },
    data: {
      onboardingCompleted: true,
      onboardingStep: STEPS.indexOf("done"),
    },
  });

  // Best-effort: email a PDF summary of everything entered during onboarding.
  // Never let this block the owner from reaching their dashboard.
  try {
    const [restaurant, owner, categoryCount, itemCount, tableCount, roomCount] = await Promise.all([
      prisma.restaurant.findUniqueOrThrow({
        where: { id: session.restaurantId },
        include: { config: true },
      }),
      prisma.adminUser.findUnique({ where: { id: session.sub }, select: { name: true, email: true } }),
      prisma.menuCategory.count({ where: { restaurantId: session.restaurantId } }),
      prisma.menuItem.count({ where: { restaurantId: session.restaurantId } }),
      prisma.restaurantTable.count({ where: { restaurantId: session.restaurantId, kind: "TABLE" } }),
      prisma.restaurantTable.count({ where: { restaurantId: session.restaurantId, kind: "ROOM" } }),
    ]);
    if (restaurant.config) {
      const pdf = await generateOnboardingSummaryPdf({
        restaurantName: restaurant.name,
        type: restaurant.type,
        slug: restaurant.slug,
        subdomain: restaurant.subdomain,
        ownerName: owner?.name ?? "—",
        ownerEmail: owner?.email ?? null,
        phone: restaurant.phone,
        address: restaurant.addressLine,
        city: restaurant.city,
        state: restaurant.state,
        gstMode: restaurant.config.gstMode,
        gstNumber: restaurant.config.gstNumber,
        serviceModel: restaurant.config.serviceModel,
        paymentTiming: restaurant.config.paymentTiming,
        onlinePaymentEnabled: restaurant.config.onlinePaymentEnabled,
        counterPaymentEnabled: restaurant.config.counterPaymentEnabled,
        categoryCount,
        itemCount,
        tableCount,
        roomCount,
        completedAt: new Date(),
      });
      await sendEmail(
        ONBOARDING_SUMMARY_EMAIL,
        `New venue onboarded: ${restaurant.name}`,
        `<p>${escapeHtml(restaurant.name)} just finished onboarding. Full details attached as a PDF.</p>`,
        [{ filename: `onboarding-${restaurant.slug}.pdf`, content: pdf }],
      );
    }
  } catch (e) {
    reportError("onboarding.summaryEmail", e, { restaurantId: session.restaurantId });
  }

  redirect("/admin");
}
