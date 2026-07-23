"use server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { getBaseUrl } from "@/lib/request";
import { emitEvent } from "@/lib/realtime/bus";
import { toNumber, formatMoney, escapeHtml } from "@/lib/utils";
import { round2 } from "@/lib/pricing";
import {
  resolveRazorpayCreds,
  createRazorpayOrder,
  verifyRazorpaySignature,
  fetchRazorpayPayment,
} from "@/lib/payments/razorpay";
import { createOtp, verifyOtp } from "@/lib/messaging/otp";
import {
  sendEmail,
  sendWhatsAppTemplate,
  sendWhatsAppFreeform,
  sendOtpSms,
} from "@/lib/messaging/provider";
import { recordUsage } from "@/lib/usage";
import { flagEnabled } from "@/lib/platform/flags";
import { rateLimit } from "@/lib/ratelimit";
import { awardPointsForOrder } from "@/lib/loyalty";

// Loads an order scoped to the scanned table's QR token (customer-safe access).
async function getCustomerOrder(orderId: string, qrToken: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      items: true,
      restaurant: { include: { config: true } },
      bill: true,
    },
  });
  if (!order || order.table?.qrToken !== qrToken || !order.restaurant.config) {
    return null;
  }
  return order;
}

type Order = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;

function billNumberFor(order: { orderNumber: number; id: string }): string {
  return `INV-${order.orderNumber}-${order.id.slice(-5).toUpperCase()}`;
}

const r2 = round2;

// --- Session bill: every open (non-cancelled, unpaid) order in the diner's
// dining session forms ONE consolidated bill — scoped to the session, not the
// table, so separate parties at a shared table are billed independently and one
// diner never sees/pays another's orders. The earliest open order is the
// "primary" billing record — it carries the tip, coupon/discount and the
// running amountPaid for the whole bill. Once settled, those orders drop out and
// the next round starts a fresh session; the fallback to [entry] keeps an
// already-paid bill view rendering (and covers sessionless POS orders). ---
async function getCustomerSession(orderId: string, qrToken: string) {
  const entry = await getCustomerOrder(orderId, qrToken);
  if (!entry) return null;
  const open = entry.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId: entry.restaurantId,
          diningSessionId: entry.diningSessionId,
          status: { not: "CANCELLED" },
          paymentStatus: { not: "PAID" },
        },
        orderBy: { createdAt: "asc" },
        include: {
          table: true,
          items: true,
          restaurant: { include: { config: true } },
          bill: true,
        },
      })
    : [];
  const orders = open.length ? open : [entry];
  const primary = orders[0];
  return { entry, orders, primary, restaurant: entry.restaurant };
}

function sessionTotal(orders: Order[]): number {
  return r2(orders.reduce((s, o) => s + toNumber(o.totalAmount), 0));
}
function sessionSubtotal(orders: Order[]): number {
  return r2(orders.reduce((s, o) => s + toNumber(o.subtotal), 0));
}
// Optional service charge added on top of the bill (percent of food subtotal).
function serviceChargeOf(orders: Order[], scPct: number): number {
  return scPct > 0 ? r2((sessionSubtotal(orders) * scPct) / 100) : 0;
}
function sessionPayable(orders: Order[], primary: Order, scPct: number): number {
  const net = Math.max(0, sessionTotal(orders) - toNumber(primary.discountAmount));
  return r2(net + serviceChargeOf(orders, scPct) + toNumber(primary.tipAmount));
}
function sessionRemaining(orders: Order[], primary: Order, scPct: number): number {
  return Math.max(0, r2(sessionPayable(orders, primary, scPct) - toNumber(primary.amountPaid)));
}
// Service-charge % for a session, read from the primary order's venue config.
function scPctOf(primary: { restaurant?: { config?: { serviceChargePercent?: unknown } | null } }): number {
  return toNumber((primary.restaurant?.config?.serviceChargePercent as number | undefined) ?? 0);
}

// Settle the whole session: mark every order paid and award loyalty once each.
async function settleSession(orders: Order[], primary: Order, method: "ONLINE" | "COUNTER" | "ROOM") {
  // Pay-first venues hold the order out of the kitchen (PLACED) until paid —
  // release it to the kitchen (CONFIRMED) now that payment has landed.
  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId: primary.restaurantId },
    select: { requirePrepayment: true, serviceChargePercent: true },
  });
  const confirmOnPay = cfg?.requirePrepayment ?? false;
  const scPct = toNumber(cfg?.serviceChargePercent ?? 0);
  const now = new Date();
  await prisma.$transaction(
    orders.map((o) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          paymentStatus: "PAID",
          paymentMethod: o.paymentMethod ?? method,
          // The whole consolidated bill's payment is recorded on the primary
          // order; others settle at 0 so SUM(amountPaid) across the bill is
          // accurate (no double-counting).
          amountPaid: o.id === primary.id ? sessionPayable(orders, primary, scPct) : 0,
          ...(confirmOnPay && o.status === "PLACED"
            ? { status: "CONFIRMED" as const, confirmedAt: now }
            : {}),
        },
      }),
    ),
  );
  for (const o of orders) {
    // A newly-confirmed prepaid order is "new" to the kitchen.
    const justConfirmed = confirmOnPay && o.status === "PLACED";
    emitEvent(
      justConfirmed
        ? { type: "order.created", restaurantId: o.restaurantId, orderId: o.id, status: "CONFIRMED" }
        : { type: "order.updated", restaurantId: o.restaurantId, orderId: o.id },
    );
    await awardPointsForOrder(o.id);
  }
}


export async function applyCouponAction(args: {
  orderId: string;
  qrToken: string;
  code: string;
}): Promise<{ ok: boolean; error?: string; discount?: number }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  const order = session.primary;
  if (order.paymentStatus === "PAID")
    return { ok: false, error: "This order is already paid." };
  if (toNumber(order.amountPaid) > 0)
    return { ok: false, error: "A payment was already made." };

  const code = args.code.trim().toUpperCase().replace(/\s+/g, "");
  const coupon = await prisma.coupon.findUnique({
    where: { restaurantId_code: { restaurantId: order.restaurantId, code } },
  });
  if (!coupon || !coupon.active)
    return { ok: false, error: "Invalid or inactive code." };
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
    return { ok: false, error: "This code has been fully used." };

  const total = sessionTotal(session.orders);
  const cur = order.restaurant.config!.currency;
  if (total < toNumber(coupon.minOrder))
    return {
      ok: false,
      error: `Minimum order ${formatMoney(coupon.minOrder, cur)} for this code.`,
    };

  let discount =
    coupon.type === "PERCENT"
      ? (total * toNumber(coupon.value)) / 100
      : toNumber(coupon.value);
  if (coupon.type === "PERCENT" && coupon.maxDiscount)
    discount = Math.min(discount, toNumber(coupon.maxDiscount));
  discount = r2(Math.min(discount, total));

  // Apply atomically. The usage count is incremented with a guard
  // (usedCount < usageLimit) so two concurrent redemptions can't both slip past
  // the limit — the DB serialises the conditional UPDATE and the loser sees 0
  // rows affected. (Switching codes also releases the previous code's count.)
  const newCode = order.couponCode !== code;
  try {
    await prisma.$transaction(async (tx) => {
      if (newCode) {
        if (coupon.usageLimit !== null) {
          const inc = await tx.coupon.updateMany({
            where: { id: coupon.id, usedCount: { lt: coupon.usageLimit } },
            data: { usedCount: { increment: 1 } },
          });
          if (inc.count === 0) throw new Error("COUPON_FULLY_USED");
        } else {
          await tx.coupon.update({
            where: { id: coupon.id },
            data: { usedCount: { increment: 1 } },
          });
        }
        if (order.couponCode) {
          await tx.coupon.updateMany({
            where: { restaurantId: order.restaurantId, code: order.couponCode, usedCount: { gt: 0 } },
            data: { usedCount: { decrement: 1 } },
          });
        }
      }
      await tx.order.update({
        where: { id: order.id },
        data: { discountAmount: discount, couponCode: code },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "COUPON_FULLY_USED") {
      return { ok: false, error: "This code has been fully used." };
    }
    throw e;
  }
  return { ok: true, discount };
}

export async function removeCouponAction(args: {
  orderId: string;
  qrToken: string;
}): Promise<{ ok: boolean }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false };
  const order = session.primary;
  if (order.paymentStatus === "PAID") return { ok: false };
  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { discountAmount: 0, couponCode: null },
    }),
    ...(order.couponCode
      ? [
          prisma.coupon.updateMany({
            where: {
              restaurantId: order.restaurantId,
              code: order.couponCode,
              usedCount: { gt: 0 },
            },
            data: { usedCount: { decrement: 1 } },
          }),
        ]
      : []),
  ]);
  return { ok: true };
}

// Set / update the tip (only allowed before any payment is taken).
export async function setTipAction(args: {
  orderId: string;
  qrToken: string;
  tipAmount: number;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  const order = session.primary;
  if (order.paymentStatus === "PAID")
    return { ok: false, error: "This order is already paid." };
  if (toNumber(order.amountPaid) > 0)
    return { ok: false, error: "A payment was already made — tip is locked." };
  const tip = r2(Math.max(0, Math.min(args.tipAmount, 100000)));
  await prisma.order.update({
    where: { id: order.id },
    data: { tipAmount: tip },
  });
  return { ok: true };
}

// Split-the-bill: override which person an item counts toward (defaults to
// the parent order's customerName otherwise — see peopleBreakdown in
// payment/page.tsx). Scoped to the diner's own session so a guest can only
// relabel items on their own table's bill, never another table's.
export async function assignItemSplitAction(args: {
  orderId: string;
  qrToken: string;
  itemId: string;
  label: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  const item = session.orders.flatMap((o) => o.items).find((it) => it.id === args.itemId);
  if (!item) return { ok: false, error: "Item not found in this bill." };
  const label = args.label.trim().slice(0, 40);
  await prisma.orderItem.update({
    where: { id: item.id },
    data: { splitLabel: label || null },
  });
  return { ok: true };
}

// Hotel in-room dining: post the whole session's bill to the room folio instead
// of paying now. The front desk settles all open room charges at checkout.
export async function chargeToRoomAction(args: {
  orderId: string;
  qrToken: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  if (session.primary.table?.kind !== "ROOM")
    return { ok: false, error: "Only available for in-room dining." };
  if (session.primary.paymentStatus === "PAID")
    return { ok: false, error: "This order is already paid." };
  if (toNumber(session.primary.amountPaid) > 0)
    return { ok: false, error: "A payment was already made." };

  await prisma.$transaction(
    session.orders.map((o) =>
      prisma.order.update({
        where: { id: o.id },
        data: { paymentStatus: "PENDING", paymentMethod: "ROOM" },
      }),
    ),
  );
  for (const o of session.orders) {
    emitEvent({ type: "order.updated", restaurantId: o.restaurantId, orderId: o.id });
  }
  return { ok: true };
}

async function ensureBill(
  order: Order,
  deliveryMethod?: "DOWNLOAD" | "WHATSAPP" | "EMAIL",
  phone?: string,
) {
  const data = {
    subtotal: order.subtotal,
    taxAmount: order.taxAmount,
    total: order.totalAmount,
    gstMode: order.gstMode,
    gstNumber: order.restaurant.config!.gstNumber,
    ...(deliveryMethod ? { deliveryMethod } : {}),
    ...(phone ? { sentToPhone: phone } : {}),
  };
  return prisma.bill.upsert({
    where: { orderId: order.id },
    create: { orderId: order.id, billNumber: billNumberFor(order), ...data },
    update: data,
  });
}

export type PaymentIntent =
  | { ok: true; mock: true; amount: number }
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

// `amount` is the portion the diner wants to pay now (a split share); defaults
// to the full remaining balance.
export async function createPaymentIntentAction(args: {
  orderId: string;
  qrToken: string;
  amount?: number;
}): Promise<PaymentIntent> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  // Throttle gateway-order creation per order (avoids spamming Razorpay/DB rows).
  if (!(await rateLimit(`payintent:${args.orderId}`, { windowMs: 60_000, max: 10 }))) {
    return { ok: false, error: "Too many attempts. Please wait a moment." };
  }
  const { orders, primary } = session;
  if (primary.paymentStatus === "PAID")
    return { ok: false, error: "This order is already paid." };

  const config = primary.restaurant.config!;
  if (!config.onlinePaymentEnabled)
    return { ok: false, error: "Online payment is not enabled." };
  // Platform kill switch (overrides every venue's own setting).
  if (!(await flagEnabled("online_payments_enabled")))
    return { ok: false, error: "Online payment is temporarily unavailable. Please pay at the counter." };

  const remaining = sessionRemaining(orders, primary, scPctOf(primary));
  if (remaining <= 0) return { ok: false, error: "Nothing left to pay." };
  const amount = r2(Math.min(Math.max(args.amount ?? remaining, 1), remaining));

  const creds = resolveRazorpayCreds(config);
  // No keys configured -> mock path (dev/staging only) so the flow stays
  // demoable. E2E_ALLOW_MOCK_PAYMENTS is a narrow CI-only escape hatch: the
  // e2e suite exercises a production build (NODE_ENV=production either way)
  // against real production, but never has real Razorpay credentials there.
  if (!creds) {
    if (!env.isStagingOrDev && process.env.E2E_ALLOW_MOCK_PAYMENTS !== "true") {
      return { ok: false, error: "Online payment is not configured." };
    }
    return { ok: true, mock: true, amount };
  }

  const rzpOrder = await createRazorpayOrder(
    creds,
    amount,
    config.currency,
    billNumberFor(primary),
  );

  await prisma.payment.create({
    data: {
      orderId: primary.id,
      amount,
      method: "ONLINE",
      provider: "RAZORPAY",
      status: "PENDING",
      razorpayOrderId: rzpOrder.id,
    },
  });

  return {
    ok: true,
    mock: false,
    razorpayOrderId: rzpOrder.id,
    amount: rzpOrder.amount,
    keyId: creds.keyId,
    currency: config.currency,
    name: primary.restaurant.name,
  };
}

export async function verifyPaymentAction(args: {
  orderId: string;
  qrToken: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  const { orders, primary } = session;
  const creds = resolveRazorpayCreds(primary.restaurant.config!);
  if (!creds) return { ok: false, error: "Payment not configured." };

  const valid = verifyRazorpaySignature(
    creds.keySecret,
    args.razorpayOrderId,
    args.razorpayPaymentId,
    args.signature,
  );
  if (!valid) {
    // Genuine failure — flag the intent so it doesn't sit stuck as PENDING and
    // the diner can cleanly retry (a fresh intent is created on the next try).
    await prisma.payment.updateMany({
      where: { orderId: primary.id, razorpayOrderId: args.razorpayOrderId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return { ok: false, error: "Payment verification failed. Please try again." };
  }

  // The Razorpay order must match a payment intent we created for THIS session,
  // and not one already consumed — prevents replaying another order's id.
  const payment = await prisma.payment.findFirst({
    where: { orderId: primary.id, razorpayOrderId: args.razorpayOrderId },
  });
  if (!payment) return { ok: false, error: "Unknown payment reference." };
  if (payment.status === "PAID") return { ok: true }; // idempotent re-verify

  // Confirm with Razorpay what was actually captured — the signature alone proves
  // the ids were issued, not that the money was captured for the right amount.
  const captured = await fetchRazorpayPayment(creds, args.razorpayPaymentId);
  if (
    !captured ||
    captured.status !== "captured" ||
    captured.orderId !== args.razorpayOrderId ||
    captured.amountPaise !== Math.round(toNumber(payment.amount) * 100)
  ) {
    return { ok: false, error: "Payment could not be confirmed. Please try again." };
  }
  const paidNow = toNumber(payment.amount);
  const newPaid = r2(toNumber(primary.amountPaid) + paidNow);
  const settled = newPaid >= sessionPayable(orders, primary, scPctOf(primary)) - 0.01;

  await prisma.payment.updateMany({
    where: { orderId: primary.id, razorpayOrderId: args.razorpayOrderId },
    data: {
      status: "PAID",
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.signature,
    },
  });

  if (settled) {
    await settleSession(orders, primary, "ONLINE");
  } else {
    await prisma.order.update({
      where: { id: primary.id },
      data: { amountPaid: newPaid },
    });
    emitEvent({
      type: "order.updated",
      restaurantId: primary.restaurantId,
      orderId: primary.id,
    });
  }
  return { ok: true };
}

// Reconcile a payment from a TRUSTED source (the Razorpay webhook) where we have
// no qrToken/diner session — resolve everything from the stored payment intent.
// Idempotent: a no-op if already PAID (e.g. the client callback got there first).
export async function reconcilePaidByRazorpayOrder(
  razorpayOrderId: string,
  razorpayPaymentId?: string,
): Promise<{ ok: boolean }> {
  const payment = await prisma.payment.findFirst({ where: { razorpayOrderId } });
  if (!payment) return { ok: false };
  if (payment.status === "PAID") return { ok: true };

  const primary = await prisma.order.findUnique({
    where: { id: payment.orderId },
    include: {
      table: true,
      items: true,
      restaurant: { include: { config: true } },
      bill: true,
    },
  });
  if (!primary || !primary.restaurant.config) return { ok: false };

  const session: Order[] = primary.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId: primary.restaurantId,
          diningSessionId: primary.diningSessionId,
          status: { not: "CANCELLED" },
          paymentStatus: { not: "PAID" },
        },
        orderBy: { createdAt: "asc" },
        include: {
          table: true,
          items: true,
          restaurant: { include: { config: true } },
          bill: true,
        },
      })
    : [primary];
  const orders = session.length ? session : [primary];

  await prisma.payment.updateMany({
    where: { id: payment.id },
    data: { status: "PAID", ...(razorpayPaymentId ? { razorpayPaymentId } : {}) },
  });

  const newPaid = r2(toNumber(primary.amountPaid) + toNumber(payment.amount));
  if (newPaid >= sessionPayable(orders, primary, scPctOf(primary)) - 0.01) {
    await settleSession(orders, primary, "ONLINE");
  } else {
    await prisma.order.update({
      where: { id: primary.id },
      data: { amountPaid: newPaid },
    });
    emitEvent({ type: "order.updated", restaurantId: primary.restaurantId, orderId: primary.id });
  }
  return { ok: true };
}

// Dev-only: simulate a successful online payment when Razorpay isn't configured.
// See E2E_ALLOW_MOCK_PAYMENTS note on createPaymentIntentAction above — same
// CI-only escape hatch, since this is only ever called after that action
// returns `mock: true`.
export async function mockMarkPaidAction(args: {
  orderId: string;
  qrToken: string;
  amount?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (!env.isStagingOrDev && process.env.E2E_ALLOW_MOCK_PAYMENTS !== "true") {
    return { ok: false, error: "Disabled." };
  }
  const session = await getCustomerSession(args.orderId, args.qrToken);
  if (!session) return { ok: false, error: "Order not found." };
  const { orders, primary } = session;
  const remaining = sessionRemaining(orders, primary, scPctOf(primary));
  const paidNow = r2(Math.min(args.amount ?? remaining, remaining));
  const newPaid = r2(toNumber(primary.amountPaid) + paidNow);
  const settled = newPaid >= sessionPayable(orders, primary, scPctOf(primary)) - 0.01;
  if (settled) {
    await settleSession(orders, primary, "ONLINE");
  } else {
    await prisma.order.update({
      where: { id: primary.id },
      data: { amountPaid: newPaid },
    });
    emitEvent({
      type: "order.updated",
      restaurantId: primary.restaurantId,
      orderId: primary.id,
    });
  }
  return { ok: true };
}

export async function requestBillOtpAction(args: {
  orderId: string;
  qrToken: string;
  phone: string;
}): Promise<{ ok: boolean; mocked?: boolean; error?: string }> {
  const order = await getCustomerOrder(args.orderId, args.qrToken);
  if (!order) return { ok: false, error: "Order not found." };
  const phone = args.phone.trim();
  if (!/^\+?\d{7,15}$/.test(phone))
    return { ok: false, error: "Enter a valid mobile number." };

  let code: string;
  try {
    code = await createOtp(phone, "WHATSAPP_BILL");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send code." };
  }
  // Meta Cloud API needs a pre-approved template (body var {{1}} = the code);
  // console mode just logs the free-form text.
  const res =
    env.messaging.provider === "meta"
      ? await sendWhatsAppTemplate(phone, env.messaging.meta.otpTemplate, [code])
      : await sendWhatsAppFreeform(
          phone,
          `Your verification code for the ${order.restaurant.name} bill is ${code}. It expires in 5 minutes.`,
          order.restaurant.config!.whatsappFrom,
        );
  if (!res.ok) {
    // Fall back to low-cost SMS when WhatsApp can't deliver the code.
    const sms = await sendOtpSms(phone, code);
    if (!sms.ok) return { ok: false, error: res.error ?? "Could not send code." };
    await recordUsage(order.restaurantId, "whatsapp");
    return { ok: true, mocked: sms.mocked };
  }
  await recordUsage(order.restaurantId, "whatsapp");
  return { ok: true, mocked: res.mocked };
}

export async function verifyBillOtpAction(args: {
  orderId: string;
  qrToken: string;
  phone: string;
  code: string;
}): Promise<{ ok: boolean; mocked?: boolean; error?: string }> {
  const order = await getCustomerOrder(args.orderId, args.qrToken);
  if (!order) return { ok: false, error: "Order not found." };
  const phone = args.phone.trim();

  const result = await verifyOtp(phone, "WHATSAPP_BILL", args.code.trim());
  if (!result.ok) return { ok: false, error: result.error };

  // Save / link the customer for dining history.
  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone, name: order.customerName ?? null },
    update: {},
  });
  if (!order.customerId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { customerId: customer.id, customerPhone: phone },
    });
  }

  // Credit loyalty points now that the customer is identified (if already paid).
  await awardPointsForOrder(order.id);

  await ensureBill(order, "WHATSAPP", phone);

  const link = `${await getBaseUrl()}/api/bill/${order.id}/pdf?t=${args.qrToken}`;
  const cur = order.restaurant.config!.currency;
  const total = toNumber(order.totalAmount).toFixed(2);
  const freeText =
    `Here's your bill from ${order.restaurant.name} (#${order.orderNumber}). ` +
    `Total: ${cur} ${total}.\nDownload: ${link}`;

  // Prefer a free-form session message when the diner has an open 24h WhatsApp
  // window (Meta only): that's free, so we send it that way and don't meter it.
  // Otherwise (window closed) use the paid utility template / SMS fallback.
  const windowOpen =
    !!customer.whatsappWindowUntil && customer.whatsappWindowUntil > new Date();
  // Named template params ({{name}}, {{amount}} — the approved "Receipt
  // attachment" template's own body text already bakes in the ₹ symbol, so
  // `amount` is the bare number, not currency-prefixed). The bill PDF itself
  // rides in the Document header, so no link needs to be spelled out in the
  // body text.
  const billHeaderDoc = { link, filename: `bill-${order.orderNumber}.pdf` };
  const billBodyParams = [
    { name: "name", value: order.restaurant.name },
    { name: "amount", value: total },
  ];
  let send: { ok: boolean; error?: string; mocked?: boolean };
  let billable = true;
  if (env.messaging.provider === "meta" && windowOpen) {
    send = await sendWhatsAppFreeform(phone, freeText);
    if (send.ok) {
      billable = false; // free inside the service window
    } else {
      // Window unexpectedly unusable — fall back to the paid template.
      send = await sendWhatsAppTemplate(
        phone,
        env.messaging.meta.billTemplate,
        billBodyParams,
        undefined,
        billHeaderDoc,
      );
    }
  } else if (env.messaging.provider === "meta") {
    send = await sendWhatsAppTemplate(
      phone,
      env.messaging.meta.billTemplate,
      billBodyParams,
      undefined,
      billHeaderDoc,
    );
  } else {
    send = await sendWhatsAppFreeform(phone, freeText, order.restaurant.config!.whatsappFrom);
  }
  if (!send.ok) return { ok: false, error: send.error ?? "Could not send bill." };
  if (billable) await recordUsage(order.restaurantId, "whatsapp");
  return { ok: true, mocked: send.mocked };
}

// Email the bill PDF link to the diner via Resend.
export async function emailBillAction(args: {
  orderId: string;
  qrToken: string;
  email: string;
}): Promise<{ ok: boolean; error?: string; mocked?: boolean }> {
  const order = await getCustomerOrder(args.orderId, args.qrToken);
  if (!order) return { ok: false, error: "Order not found." };
  const email = args.email.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  await ensureBill(order, "EMAIL");
  const link = `${await getBaseUrl()}/api/bill/${order.id}/pdf?t=${args.qrToken}`;
  const name = order.restaurant.name;
  const safeName = escapeHtml(name);
  const cur = order.restaurant.config!.currency;
  const total = toNumber(order.totalAmount).toFixed(2);
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
    <h2 style="margin:0 0 8px">Thanks for dining at ${safeName}!</h2>
    <p style="margin:0 0 16px">Here's your bill (#${order.orderNumber}) — total <strong>${cur} ${total}</strong>.</p>
    <p style="margin:0 0 20px"><a href="${link}" style="background:#d93d0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Download your bill (PDF)</a></p>
    <p style="color:#999;font-size:12px;margin:0">Powered by Scan2Order</p>
  </div>`;
  const send = await sendEmail(email, `Your bill from ${name} (#${order.orderNumber})`, html);
  if (!send.ok) return { ok: false, error: send.error ?? "Could not send the email." };
  await recordUsage(order.restaurantId, "email");
  return { ok: true, mocked: send.mocked };
}

// Records that the customer downloaded their bill (creates the Bill row).
export async function markBillDownloadedAction(args: {
  orderId: string;
  qrToken: string;
}): Promise<{ ok: boolean }> {
  const order = await getCustomerOrder(args.orderId, args.qrToken);
  if (!order) return { ok: false };
  await ensureBill(order, "DOWNLOAD");
  return { ok: true };
}
