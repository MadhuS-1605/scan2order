import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ClipboardList,
  CheckCircle2,
  ChefHat,
  BellRing,
  UtensilsCrossed,
  ArrowRight,
  Plus,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { CUSTOMER_STEPS } from "@/lib/orders/status";
import { round2 } from "@/lib/pricing";
import { getActiveTableToken } from "@/lib/table-session";
import { LiveRefresh } from "@/components/live-refresh";
import { EnableNotifications } from "@/components/enable-notifications";
import { ServiceButton } from "@/components/service-button";
import { FeedbackCard } from "@/components/feedback-card";
import { CustomerHeader, PoweredBy } from "@/components/customer-header";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import { StatusBadge } from "@/components/ui";

const STEP_ICONS = [ClipboardList, CheckCircle2, ChefHat, BellRing, UtensilsCrossed];

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const tableToken = await getActiveTableToken();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      table: true,
      restaurant: { include: { config: true, group: { select: { name: true } } } },
      feedback: true,
    },
  });
  // Only the diner who scanned this table (matching cookie) may view the order.
  if (!order || !order.table || order.table.qrToken !== tableToken) notFound();
  const qrToken = order.table.qrToken;

  // Session-based bill: a diner's own rounds (same dining session) consolidate
  // into one bill — scoped to the session, never the whole table, so separate
  // parties at one table never see each other's orders. Includes paid rounds so
  // the bill stays aggregated after settlement. Falls back to this order alone
  // for sessionless (e.g. staff POS) orders.
  const sessionOrders = order.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId: order.restaurantId,
          diningSessionId: order.diningSessionId,
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
        include: { items: true },
      })
    : [order];
  const primary = sessionOrders[0] ?? order;

  const cur = order.restaurant.config?.currency ?? "INR";
  const cancelled = order.status === "CANCELLED";
  const currentIndex = CUSTOMER_STEPS.findIndex((s) => s.status === order.status);
  const completed = order.status === "COMPLETED";
  // Location withheld -> order is held for a staff member to approve before it
  // goes to the kitchen. Drives the "waiting for staff" messaging below.
  const held = order.presence === "UNVERIFIED" && order.status === "PLACED";
  // Pay-first venue: the order is held out of the kitchen until it's paid.
  const awaitingPrepay =
    Boolean(order.restaurant.config?.requirePrepayment) &&
    order.status === "PLACED" &&
    order.paymentStatus !== "PAID";
  const payAfter = order.restaurant.config?.paymentTiming === "PAY_AFTER";
  const canRate =
    (order.status === "SERVED" || order.status === "COMPLETED") && !order.feedback;

  // Estimated ready time = confirmation + the venue's default prep minutes.
  // Shown only while the order is actively being prepared. Remaining minutes is
  // a duration, so it's timezone-independent.
  const prepMin = order.restaurant.config?.defaultPrepMinutes ?? 0;
  const etaMin =
    (order.status === "CONFIRMED" || order.status === "PREPARING") &&
    prepMin > 0 &&
    order.confirmedAt
      ? Math.max(
          0,
          Math.ceil((order.confirmedAt.getTime() + prepMin * 60000 - Date.now()) / 60000),
        )
      : null;

  const sessionTotal = round2(sessionOrders.reduce((s, o) => s + toNumber(o.totalAmount), 0));
  const payable = round2(
    Math.max(0, sessionTotal - toNumber(primary.discountAmount)) + toNumber(primary.tipAmount),
  );
  const allPaid = sessionOrders.every((o) => o.paymentStatus === "PAID");
  const multiRound = sessionOrders.length > 1;

  return (
    <div className="min-h-screen bg-grain">
      {!completed && !cancelled && <LiveRefresh intervalMs={4000} />}
      <CustomerHeader
        restaurantName={order.restaurant.name}
        groupName={order.restaurant.group?.name}
        seat={seatLabel(order.table)}
        logoUrl={order.restaurant.logoUrl}
      />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24 sm:py-8 sm:pb-24">
        <div className="overflow-hidden rounded-2xl border border-brand-200 bg-surface text-center">
          <div className="bg-brand-50 px-6 py-7">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand-700/70">
              {multiRound ? "Latest order" : "Your order number"}
            </p>
            <p className="mt-1 font-display text-7xl font-medium leading-none text-brand-600">
              #{order.orderNumber}
            </p>
            <p className="mt-3 text-xs uppercase tracking-wide text-ink/45">
              {order.restaurant.name} · {seatLabel(order.table)}
            </p>
          </div>
          <div className="px-6 pb-6 pt-4">
            <p className="text-sm text-ink/55">
              {cancelled
                ? "This order was cancelled."
                : completed
                  ? "Order complete. Enjoy your meal!"
                  : awaitingPrepay
                    ? "Almost there — complete payment to send your order to the kitchen."
                    : held
                      ? "We've received your order — waiting for a staff member to approve it."
                      : "We've got your order — show this number to collect."}
            </p>
            {etaMin !== null && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                🍳 {etaMin > 0 ? `Ready in ~${etaMin} min` : "Ready any moment now"}
              </p>
            )}
            {order.fulfillment === "PICKUP" && (
              <p className="mt-2 text-sm text-ink/55">🥡 Pickup order</p>
            )}
            {order.fulfillment === "DELIVERY" && (
              <p className="mt-2 text-sm text-ink/55">
                🛵 Delivery to: {order.deliveryAddress}
              </p>
            )}
          </div>
        </div>

        {awaitingPrepay && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            <p className="font-medium">⏳ Waiting for payment</p>
            <p className="mt-1 text-amber-800/80">
              Your order goes to the kitchen as soon as it&apos;s paid. Pay now
              below, or at the counter — this page updates automatically.
            </p>
          </div>
        )}

        {held && !awaitingPrepay && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            <p className="font-medium">⏳ Waiting for staff approval</p>
            <p className="mt-1 text-amber-800/80">
              Since we couldn&apos;t confirm your location, a waiter will approve
              your order at your table and send it to the kitchen. No need to do
              anything — this page updates automatically.
            </p>
          </div>
        )}

        {!cancelled && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/menu"
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-surface px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
            >
              <Plus className="h-4 w-4" />
              Order more items
            </Link>
            {!completed && (
              <EnableNotifications scope="order" orderId={orderId} qrToken={qrToken} />
            )}
            {!completed && <ServiceButton qrToken={qrToken} />}
          </div>
        )}

        {!cancelled && (
          <div className="rounded-2xl border border-sand-200 bg-surface p-6">
            <ol className="relative space-y-6">
              <span
                className="absolute left-[18px] top-2 bottom-2 w-px bg-sand-200"
                aria-hidden
              />
              {CUSTOMER_STEPS.map((step, i) => {
                const done = i < currentIndex || completed;
                const active = i === currentIndex && !completed;
                const Icon = STEP_ICONS[i] ?? CheckCircle2;
                return (
                  <li key={step.status} className="relative flex items-center gap-4">
                    <span
                      className={`z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
                        done || active ? "bg-brand-600 text-white" : "bg-sand-100 text-ink/35"
                      } ${active ? "ring-4 ring-brand-100" : ""}`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span
                      className={`text-sm ${done || active ? "font-medium text-ink" : "text-ink/40"}`}
                    >
                      {step.label}
                      {active && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-brand-600">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                          in progress
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {multiRound && (
          <div className="rounded-2xl border border-sand-200 bg-surface p-5">
            <h2 className="mb-3 font-display text-lg text-ink">Your orders this visit</h2>
            <ul className="space-y-2">
              {sessionOrders.map((o) => {
                const isCurrent = o.id === order.id;
                return (
                  <li key={o.id}>
                    <Link
                      href={`/order/${o.id}`}
                      className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 transition-colors ${
                        isCurrent
                          ? "border-brand-300 bg-brand-50"
                          : "border-sand-200 hover:bg-sand-100"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="text-sm font-medium text-ink">#{o.orderNumber}</span>
                        <span className="ml-2 text-xs text-ink/50">
                          {o.items.length} item{o.items.length > 1 ? "s" : ""} ·{" "}
                          {formatMoney(toNumber(o.totalAmount), cur)}
                        </span>
                      </span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <h2 className="mb-3 font-display text-lg text-ink">
            {multiRound ? `Order #${order.orderNumber}` : "Order summary"}
          </h2>
          <ul className="space-y-1.5 text-sm text-ink/80">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>
                  {it.quantity}× {it.nameSnapshot}
                  {modifierSummary(it.modifiers) && (
                    <span className="text-ink/45"> ({modifierSummary(it.modifiers)})</span>
                  )}
                </span>
                <span>{formatMoney(toNumber(it.lineTotal), cur)}</span>
              </li>
            ))}
          </ul>
          {multiRound && (
            <div className="mt-3 flex justify-between border-t border-sand-100 pt-3 text-sm">
              <span className="text-ink/55">This visit ({sessionOrders.length} orders)</span>
              <span className="font-semibold text-ink">{formatMoney(payable, cur)}</span>
            </div>
          )}
        </div>

        {!allPaid && !cancelled && (
          <Link
            href={`/payment?order=${orderId}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-center font-medium text-white transition-all hover:bg-brand-700 active:translate-y-px"
          >
            {awaitingPrepay ? "Pay now to confirm" : payAfter ? "Request bill & pay" : "View bill"}
            {multiRound ? ` · ${formatMoney(payable, cur)}` : ""}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {canRate && (
          <FeedbackCard
            orderId={orderId}
            qrToken={qrToken}
            restaurantName={order.restaurant.name}
          />
        )}

        <Link
          href="/account"
          className="block text-center text-sm font-medium text-ink/50 hover:text-ink"
        >
          View your orders &amp; rewards →
        </Link>

        <PoweredBy />
      </div>
      <CustomerTabBar />
    </div>
  );
}
