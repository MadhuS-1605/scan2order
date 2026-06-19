"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/payments/razorpay";
import { planByTier, type PlanTier } from "@/lib/plans";
import { recordAudit } from "@/lib/audit";

const PERIOD_DAYS = 30;
const DAY = 86_400_000;

export type PlanIntent =
  | { ok: true; mock: true }
  | {
      ok: true;
      mock: false;
      razorpayOrderId: string;
      amount: number;
      keyId: string;
      currency: string;
      name: string;
    }
  | { ok: false; error: string };

// Tenant subscriptions are collected by the PLATFORM, so use the platform's
// Razorpay keys (not the restaurant's own diner-payment keys).
function platformCreds() {
  return env.razorpay.configured()
    ? { keyId: env.razorpay.keyId, keySecret: env.razorpay.keySecret }
    : null;
}

// Extend the plan from the later of now / current expiry, so paying before
// expiry stacks the new period instead of losing remaining days.
async function activate(restaurantId: string, tier: PlanTier, periodDays = PERIOD_DAYS) {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { planActiveUntil: true },
  });
  const base =
    r?.planActiveUntil && r.planActiveUntil.getTime() > Date.now()
      ? r.planActiveUntil.getTime()
      : Date.now();
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { planTier: tier, planActiveUntil: new Date(base + periodDays * DAY), planIsTrial: false },
  });
}

export async function startPlanCheckoutAction(tierInput: string): Promise<PlanIntent> {
  const session = await requireAdminWithPermission("settings");
  const tier = tierInput as PlanTier;
  const plan = planByTier(tier);
  if (plan.tier === "FREE" || plan.price <= 0) {
    return { ok: false, error: "Choose a paid plan." };
  }
  const creds = platformCreds();
  if (!creds) return { ok: true, mock: true }; // dev: no gateway -> client calls mock activate

  const order = await createRazorpayOrder(
    creds,
    plan.price,
    "INR",
    `plan-${session.restaurantId.slice(-6)}-${tier}`,
  );
  await prisma.planPayment.create({
    data: {
      restaurantId: session.restaurantId,
      tier,
      amount: plan.price,
      periodDays: PERIOD_DAYS,
      status: "PENDING",
      razorpayOrderId: order.id,
    },
  });
  return {
    ok: true,
    mock: false,
    razorpayOrderId: order.id,
    amount: order.amount,
    keyId: creds.keyId,
    currency: "INR",
    name: "Scan to Order",
  };
}

export async function verifyPlanPaymentAction(args: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWithPermission("settings");
  const creds = platformCreds();
  if (!creds) return { ok: false, error: "Payment not configured." };
  if (
    !verifyRazorpaySignature(creds.keySecret, args.razorpayOrderId, args.razorpayPaymentId, args.signature)
  ) {
    await prisma.planPayment.updateMany({
      where: { razorpayOrderId: args.razorpayOrderId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, error: "Payment verification failed. Please try again." };
  }
  const pp = await prisma.planPayment.findFirst({
    where: { razorpayOrderId: args.razorpayOrderId, restaurantId: session.restaurantId },
  });
  if (!pp) return { ok: false, error: "Unknown payment reference." };
  if (pp.status !== "PAID") {
    await prisma.planPayment.updateMany({
      where: { id: pp.id },
      data: { status: "PAID", razorpayPaymentId: args.razorpayPaymentId },
    });
    await activate(session.restaurantId, pp.tier, pp.periodDays);
    await recordAudit(session.restaurantId, session, "plan.subscribed", `${pp.tier} · ${pp.periodDays}d`);
  }
  revalidatePath("/admin/billing");
  return { ok: true };
}

// Dev / Razorpay-not-configured: activate without a real charge.
export async function mockActivatePlanAction(tierInput: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWithPermission("settings");
  if (platformCreds()) return { ok: false, error: "Use the live payment flow." };
  const tier = tierInput as PlanTier;
  const plan = planByTier(tier);
  if (plan.tier === "FREE" || plan.price <= 0) return { ok: false, error: "Choose a paid plan." };
  await prisma.planPayment.create({
    data: { restaurantId: session.restaurantId, tier, amount: plan.price, periodDays: PERIOD_DAYS, status: "PAID" },
  });
  await activate(session.restaurantId, tier);
  await recordAudit(session.restaurantId, session, "plan.subscribed_mock", tier);
  revalidatePath("/admin/billing");
  return { ok: true };
}

// Webhook reconciliation (no session) — confirm a tenant plan payment.
export async function reconcilePlanPaymentByRazorpayOrder(
  razorpayOrderId: string,
  razorpayPaymentId?: string,
): Promise<{ ok: boolean }> {
  const pp = await prisma.planPayment.findFirst({ where: { razorpayOrderId } });
  if (!pp) return { ok: false };
  if (pp.status === "PAID") return { ok: true };
  await prisma.planPayment.updateMany({
    where: { id: pp.id },
    data: { status: "PAID", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) },
  });
  await activate(pp.restaurantId, pp.tier, pp.periodDays);
  return { ok: true };
}

// --- Auto-renew (Razorpay eMandate / Subscriptions) ---

export type AutoRenewIntent =
  | { ok: true; subscriptionId: string; keyId: string; name: string }
  | { ok: false; error: string };

export async function startAutoRenewAction(tierInput: string): Promise<AutoRenewIntent> {
  const session = await requireAdminWithPermission("settings");
  const tier = tierInput as PlanTier;
  const plan = planByTier(tier);
  if (plan.tier === "FREE" || plan.price <= 0) return { ok: false, error: "Choose a paid plan." };
  const creds = platformCreds();
  const planId = env.razorpay.planIds[tier];
  if (!creds || !planId) {
    return { ok: false, error: "Auto-renew isn't set up for this plan yet — use one-time payment." };
  }
  const sub = await createRazorpaySubscription(creds, planId);
  await prisma.restaurant.update({
    where: { id: session.restaurantId },
    data: { razorpaySubscriptionId: sub.id },
  });
  return { ok: true, subscriptionId: sub.id, keyId: creds.keyId, name: "Scan to Order" };
}

export async function verifyAutoRenewAction(args: {
  tier: string;
  razorpaySubscriptionId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWithPermission("settings");
  const creds = platformCreds();
  if (!creds) return { ok: false, error: "Payment not configured." };
  if (
    !verifyRazorpaySubscriptionSignature(
      creds.keySecret,
      args.razorpayPaymentId,
      args.razorpaySubscriptionId,
      args.signature,
    )
  ) {
    return { ok: false, error: "Verification failed. Please try again." };
  }
  const restaurant = await prisma.restaurant.findFirst({
    where: { id: session.restaurantId, razorpaySubscriptionId: args.razorpaySubscriptionId },
    select: { id: true, planActiveUntil: true },
  });
  if (!restaurant) return { ok: false, error: "Unknown subscription." };
  const tier = args.tier as PlanTier;
  const base =
    restaurant.planActiveUntil && restaurant.planActiveUntil.getTime() > Date.now()
      ? restaurant.planActiveUntil.getTime()
      : Date.now();
  await prisma.restaurant.update({
    where: { id: restaurant.id },
    data: {
      planTier: tier,
      planActiveUntil: new Date(base + PERIOD_DAYS * DAY),
      planIsTrial: false,
      planAutoRenew: true,
    },
  });
  await recordAudit(session.restaurantId, session, "plan.autorenew_on", tier);
  revalidatePath("/admin/billing");
  return { ok: true };
}

export async function cancelAutoRenewAction(): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  const r = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { razorpaySubscriptionId: true },
  });
  const creds = platformCreds();
  if (creds && r?.razorpaySubscriptionId) {
    try {
      await cancelRazorpaySubscription(creds, r.razorpaySubscriptionId);
    } catch {
      // already cancelled / gateway hiccup — clear the flag locally regardless
    }
  }
  // Keep planActiveUntil (the current paid period stands); just stop renewing.
  await prisma.restaurant.update({
    where: { id: session.restaurantId },
    data: { planAutoRenew: false, razorpaySubscriptionId: null },
  });
  await recordAudit(session.restaurantId, session, "plan.autorenew_off", "");
  revalidatePath("/admin/billing");
}

// Webhook: react to Razorpay subscription lifecycle events (no session).
export async function reconcileSubscriptionEvent(
  eventType: string,
  subscriptionId: string,
): Promise<{ ok: boolean }> {
  const r = await prisma.restaurant.findFirst({
    where: { razorpaySubscriptionId: subscriptionId },
    select: { id: true, planActiveUntil: true },
  });
  if (!r) return { ok: false };
  if (eventType === "subscription.charged" || eventType === "subscription.activated") {
    const base =
      r.planActiveUntil && r.planActiveUntil.getTime() > Date.now()
        ? r.planActiveUntil.getTime()
        : Date.now();
    await prisma.restaurant.update({
      where: { id: r.id },
      data: { planActiveUntil: new Date(base + PERIOD_DAYS * DAY), planAutoRenew: true, planIsTrial: false },
    });
  } else if (
    eventType === "subscription.cancelled" ||
    eventType === "subscription.halted" ||
    eventType === "subscription.completed"
  ) {
    await prisma.restaurant.update({
      where: { id: r.id },
      data: { planAutoRenew: false },
    });
  }
  return { ok: true };
}

export async function downgradeToFreeAction(): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  await prisma.restaurant.update({
    where: { id: session.restaurantId },
    data: { planTier: "FREE", planActiveUntil: null, planIsTrial: false },
  });
  await recordAudit(session.restaurantId, session, "plan.downgraded", "FREE");
  revalidatePath("/admin/billing");
}
