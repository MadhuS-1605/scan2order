"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  requireAdmin,
  requireOnboardedAdmin,
  requireAdminWithPermission,
} from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { slugify } from "@/lib/utils";
import { validateSubdomain } from "@/lib/subdomain";
import { ensureSubdomain, syncSubdomain } from "@/lib/cloudflare";
import { tableQuotaReached, menuItemQuotaReached } from "@/lib/plan-limits";
import { STEPS, type Step } from "@/lib/onboarding/steps";
import {
  profileSchema,
  settingsSchema,
  categorySchema,
  menuItemSchema,
  tableSchema,
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

  const selfService = data.serviceModel === "SELF_SERVICE";
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
  const featureDefaults = {
    featureReservations: t !== "CLOUD_KITCHEN",
    featureRooms: t === "HOTEL",
    featureBanquets: t === "HOTEL",
    featureBar: t === "BAR",
    // Dine-in venues require diners to be on-site to order (anti-fake-order);
    // cloud kitchens take remote orders, so it's off there.
    requireDinerLocation: t !== "CLOUD_KITCHEN",
    // Cloud kitchens are takeaway/delivery by default.
    pickupEnabled: t === "CLOUD_KITCHEN",
    deliveryEnabled: t === "CLOUD_KITCHEN",
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
      // Start a 14-day full-feature trial on Starter; lapses to Free limits.
      planTier: "STARTER",
      planIsTrial: true,
      planActiveUntil: new Date(Date.now() + 14 * 86_400_000),
      config: { create: { onboardingStep: 1, ...featureDefaults, ...serviceDefaults } },
    },
  });
  if (selfService) await ensureCounterTable(restaurant.id);

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
      data: { restaurantId, label: "Counter", kind: "COUNTER", seats: 0 },
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
    isAvailable: formData.get("isAvailable") === "true",
    isSpecialOfDay: formData.get("isSpecialOfDay") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  await prisma.menuItem.create({
    data: {
      restaurantId: session.restaurantId,
      categoryId: d.categoryId || null,
      name: d.name,
      description: d.description || null,
      price: d.price,
      imageUrl: d.imageUrl || null,
      isVeg: d.isVeg,
      isAvailable: d.isAvailable,
      isSpecialOfDay: d.isSpecialOfDay,
      availableFrom: d.availableFrom || null,
      availableTo: d.availableTo || null,
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
      gstNumber: d.gstNumber || null,
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
    },
  });
  revalidatePath("/onboarding");
  revalidatePath("/admin/tables");
  return { ok: true };
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
  redirect("/admin");
}
