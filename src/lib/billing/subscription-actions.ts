"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import {
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
  fetchRazorpaySubscription,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  verifyRazorpaySubscriptionSignature,
} from "@/lib/payments/razorpay";
import { planByTier, type PlanTier } from "@/lib/plans";
import { resolvePlanPrice } from "@/lib/plan-settings";
import { recordAudit } from "@/lib/audit";
import {
  getOutstandingOverage,
  buildPendingOverageCharges,
  attachOverageToOrder,
  reconcileOverageByRazorpayOrder,
  settleOverageAsPaid,
} from "@/lib/billing/overage";
import { notifyOverageSettled } from "@/lib/billing/overage-notify";

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

// Validate a promo code against a base price; returns the discounted price and
// the canonical code (null if the code is absent/invalid/expired/exhausted).
async function applyPlanCoupon(
  price: number,
  codeInput?: string,
): Promise<{ discounted: number; coupon: string | null }> {
  const code = (codeInput ?? "").trim().toUpperCase();
  if (!code) return { discounted: price, coupon: null };
  const c = await prisma.planCoupon.findUnique({ where: { code } });
  if (!c || !c.active) return { discounted: price, coupon: null };
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) return { discounted: price, coupon: null };
  if (c.maxRedemptions != null && c.redeemedCount >= c.maxRedemptions) return { discounted: price, coupon: null };
  const val = Number(c.value);
  const off = c.type === "PERCENT" ? price * (val / 100) : val;
  const discounted = Math.max(1, Math.round((price - off) * 100) / 100);
  return { discounted, coupon: c.code };
}

// Redeem a promo code atomically — the conditional UPDATE only succeeds while
// redeemedCount is still under the cap, so concurrent settlements (browser
// callback + webhook racing on the same order) can't both slip past
// maxRedemptions; the loser affects 0 rows. Mirrors the diner-coupon guard in
// src/lib/billing/actions.ts.
async function redeemPlanCoupon(code: string): Promise<void> {
  const c = await prisma.planCoupon.findUnique({ where: { code }, select: { maxRedemptions: true } });
  if (!c) return;
  await prisma.planCoupon.updateMany({
    where: {
      code,
      ...(c.maxRedemptions != null ? { redeemedCount: { lt: c.maxRedemptions } } : {}),
    },
    data: { redeemedCount: { increment: 1 } },
  });
}

export async function startPlanCheckoutAction(tierInput: string, codeInput?: string): Promise<PlanIntent> {
  const session = await requireAdminWithPermission("settings");
  const tier = tierInput as PlanTier;
  const plan = planByTier(tier);
  if (plan.tier === "FREE" || plan.price <= 0) {
    return { ok: false, error: "Choose a paid plan." };
  }
  const creds = platformCreds();
  if (!creds) return { ok: true, mock: true }; // dev: no gateway -> client calls mock activate

  // Apply a promo code (if valid) to the (operator-set) plan price.
  const basePrice = await resolvePlanPrice(tier);
  const { discounted, coupon } = await applyPlanCoupon(basePrice, codeInput);

  // Bundle any outstanding usage overage into this plan-extend order, so the
  // owner settles plan + overage in one payment.
  const { total: overage } = await buildPendingOverageCharges(session.restaurantId);

  const order = await createRazorpayOrder(
    creds,
    discounted + overage,
    "INR",
    `plan-${session.restaurantId.slice(-6)}-${tier}`,
  );
  const pp = await prisma.planPayment.create({
    data: {
      restaurantId: session.restaurantId,
      tier,
      amount: discounted,
      periodDays: PERIOD_DAYS,
      status: "PENDING",
      razorpayOrderId: order.id,
      couponCode: coupon,
    },
  });
  if (overage > 0) {
    await attachOverageToOrder(session.restaurantId, order.id, pp.id);
  }
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
  if (pp.status === "PAID") return { ok: true };
  // Confirm the payment was actually captured for THIS order (amount is enforced
  // by the server-created Razorpay order).
  const captured = await fetchRazorpayPayment(creds, args.razorpayPaymentId);
  if (!captured || captured.status !== "captured" || captured.orderId !== args.razorpayOrderId) {
    return { ok: false, error: "Payment could not be confirmed." };
  }
  await prisma.planPayment.updateMany({
    where: { id: pp.id },
    data: { status: "PAID", razorpayPaymentId: args.razorpayPaymentId },
  });
  await activate(session.restaurantId, pp.tier, pp.periodDays);
  // Settle any overage that rode along on this order, then notify the owner.
  const ovg = await reconcileOverageByRazorpayOrder(
    args.razorpayOrderId,
    args.razorpayPaymentId,
    session.restaurantId,
  );
  if (ovg.amount > 0) await notifyOverageSettled(session.restaurantId, ovg.amount);
  if (pp.couponCode) await redeemPlanCoupon(pp.couponCode);
  await recordAudit(session.restaurantId, session, "plan.subscribed", `${pp.tier} · ${pp.periodDays}d`);
  revalidatePath("/admin/billing");
  return { ok: true };
}

// Dev / Razorpay-not-configured: activate without a real charge.
export async function mockActivatePlanAction(tierInput: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWithPermission("settings");
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Not available." };
  if (platformCreds()) return { ok: false, error: "Use the live payment flow." };
  const tier = tierInput as PlanTier;
  const plan = planByTier(tier);
  if (plan.tier === "FREE" || plan.price <= 0) return { ok: false, error: "Choose a paid plan." };
  await prisma.planPayment.create({
    data: { restaurantId: session.restaurantId, tier, amount: plan.price, periodDays: PERIOD_DAYS, status: "PAID" },
  });
  await activate(session.restaurantId, tier);
  // Mirror the live bundle: clear any outstanding overage too.
  const { total: ovgTotal } = await settleOverageAsPaid(session.restaurantId);
  if (ovgTotal > 0) await notifyOverageSettled(session.restaurantId, ovgTotal);
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
  // Settle any overage bundled onto the same order, then notify the owner.
  const ovg = await reconcileOverageByRazorpayOrder(razorpayOrderId, razorpayPaymentId, pp.restaurantId);
  if (ovg.amount > 0) await notifyOverageSettled(pp.restaurantId, ovg.amount);
  if (pp.couponCode) await redeemPlanCoupon(pp.couponCode);
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
  // Derive the tier from the subscription's actual Razorpay plan id — never trust
  // the client-supplied tier (would let a Starter subscriber claim Pro).
  const sub = await fetchRazorpaySubscription(creds, args.razorpaySubscriptionId);
  const tier = (Object.entries(env.razorpay.planIds).find(
    ([, planId]) => planId && planId === sub?.planId,
  )?.[0] as PlanTier | undefined);
  if (!tier) return { ok: false, error: "Could not determine the plan for this subscription." };
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

// --- Overage settlement (standalone "Settle now") ---

// Start a standalone Razorpay checkout for outstanding usage overage. Uses the
// same platform creds + PlanIntent shape as plan checkout.
export async function startOverageCheckoutAction(): Promise<PlanIntent> {
  const session = await requireAdminWithPermission("settings");
  const creds = platformCreds();
  if (!creds) {
    // dev: no gateway -> client calls the mock settle path
    const { total } = await getOutstandingOverage(session.restaurantId);
    if (total <= 0) return { ok: false, error: "No overage to settle." };
    return { ok: true, mock: true };
  }
  const { total } = await buildPendingOverageCharges(session.restaurantId);
  if (total <= 0) return { ok: false, error: "No overage to settle." };
  const order = await createRazorpayOrder(
    creds,
    total,
    "INR",
    `ovg-${session.restaurantId.slice(-6)}`,
  );
  await attachOverageToOrder(session.restaurantId, order.id);
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

export async function verifyOveragePaymentAction(args: {
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
    return { ok: false, error: "Payment verification failed. Please try again." };
  }
  const captured = await fetchRazorpayPayment(creds, args.razorpayPaymentId);
  if (!captured || captured.status !== "captured" || captured.orderId !== args.razorpayOrderId) {
    return { ok: false, error: "Payment could not be confirmed." };
  }
  const ovg = await reconcileOverageByRazorpayOrder(
    args.razorpayOrderId,
    args.razorpayPaymentId,
    session.restaurantId,
  );
  if (ovg.amount > 0) await notifyOverageSettled(session.restaurantId, ovg.amount);
  await recordAudit(session.restaurantId, session, "overage.settled", args.razorpayOrderId);
  revalidatePath("/admin/billing");
  return { ok: true };
}

// Dev / Razorpay-not-configured: settle overage without a real charge.
export async function mockSettleOverageAction(): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminWithPermission("settings");
  if (process.env.NODE_ENV === "production") return { ok: false, error: "Not available." };
  if (platformCreds()) return { ok: false, error: "Use the live payment flow." };
  const { total } = await settleOverageAsPaid(session.restaurantId);
  if (total <= 0) return { ok: false, error: "No overage to settle." };
  await notifyOverageSettled(session.restaurantId, total);
  await recordAudit(session.restaurantId, session, "overage.settled_mock", String(total));
  revalidatePath("/admin/billing");
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
