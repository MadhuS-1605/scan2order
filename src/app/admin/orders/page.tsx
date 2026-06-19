import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { sweepStaleOrders } from "@/lib/orders/sweep";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { LiveStream } from "@/components/live-stream";
import { EnableNotifications } from "@/components/enable-notifications";
import { ActionButton } from "@/components/admin/action-button";
import {
  ACTIVE_STATUSES,
  nextStatus,
  STATUS_ACTION_LABEL,
  type OrderStatus,
} from "@/lib/orders/status";
import {
  confirmOrderAction,
  rejectOrderAction,
  setOrderStatusAction,
  markPaidAction,
} from "@/lib/orders/actions";
import { resolveServiceRequestAction } from "@/lib/service/actions";
import { Bell } from "lucide-react";

const SERVICE_LABEL: Record<string, string> = {
  CALL_WAITER: "Waiter",
  WATER: "Water",
  BILL: "Bill",
  CLEAN_TABLE: "Clean table",
  OTHER: "Service",
};

const BTN = {
  primary:
    "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60",
  danger:
    "rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60",
  secondary:
    "rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100 disabled:opacity-60",
};

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export default async function OrdersBoard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  // Lazy housekeeping: recover stuck payment intents + cancel abandoned
  // pay-first orders so the board stays clean. Cheap + idempotent.
  await sweepStaleOrders(restaurant.id);
  const sp = await searchParams;
  const statusFilter = ACTIVE_STATUSES.includes(sp.status as OrderStatus)
    ? (sp.status as OrderStatus)
    : null;

  const [orders, serviceRequests] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        status: statusFilter ? statusFilter : { in: ACTIVE_STATUSES },
      },
      orderBy: { createdAt: "asc" },
      include: { table: true, items: true },
    }),
    prisma.serviceRequest.findMany({
      where: { restaurantId: restaurant.id, status: "OPEN" },
      orderBy: { createdAt: "asc" },
      include: { table: true },
    }),
  ]);

  const waiterConfirm = config.orderConfirmation === "WAITER_CONFIRM";
  const cur = config.currency;

  // Group active orders by table (matches table-based billing).
  const groups = new Map<
    string,
    { label: string; orders: typeof orders; total: number }
  >();
  for (const o of orders) {
    const key = o.tableId ?? "__none__";
    const g =
      groups.get(key) ??
      ({
        label: o.table ? seatLabel(o.table) : "Takeaway / no table",
        orders: [],
        total: 0,
      } as { label: string; orders: typeof orders; total: number });
    g.orders.push(o);
    g.total += toNumber(o.totalAmount);
    groups.set(key, g);
  }
  const groupList = [...groups.values()];

  const filterPill = (active: boolean) =>
    `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-ink text-white" : "text-ink/60 hover:bg-sand-100"
    }`;

  return (
    <div className="space-y-5">
      <LiveStream />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-medium text-ink">Live orders</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink/45">{orders.length} active</span>
          <Link
            href="/admin/orders/new"
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            + New order
          </Link>
          <Link
            href="/admin/orders/history"
            className="rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
          >
            Past orders
          </Link>
          <EnableNotifications scope="restaurant" />
        </div>
      </div>

      {/* Status filter */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-sand-200 bg-surface p-1">
        <Link href="/admin/orders" className={filterPill(!statusFilter)}>
          All
        </Link>
        {ACTIVE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            className={filterPill(statusFilter === s)}
          >
            {titleCase(s)}
          </Link>
        ))}
      </div>

      {serviceRequests.length > 0 && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
            <Bell className="h-4 w-4" />
            Service requests ({serviceRequests.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {serviceRequests.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-2 rounded-lg border border-brand-200 bg-surface px-3 py-1.5"
              >
                <span className="text-sm text-ink">
                  <span className="font-semibold">{seatLabel(r.table)}</span> ·{" "}
                  {SERVICE_LABEL[r.type] ?? r.type}
                </span>
                <ActionButton
                  action={resolveServiceRequestAction}
                  fields={{ id: r.id }}
                  success="Request resolved"
                  className="rounded-md bg-brand-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-brand-700"
                >
                  Resolve
                </ActionButton>
              </span>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand-300 bg-surface p-12 text-center text-ink/55">
          {statusFilter ? `No ${titleCase(statusFilter)} orders.` : "No active orders right now."}
        </div>
      ) : (
        <div className="space-y-6">
          {groupList.map((g) => (
            <section key={g.label}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-display text-lg text-ink">
                  {g.label}
                  <span className="ml-2 text-sm font-normal text-ink/45">
                    {g.orders.length} order{g.orders.length > 1 ? "s" : ""}
                  </span>
                </h2>
                <span className="text-sm font-medium text-ink/60">
                  {formatMoney(g.total, cur)}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.orders.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    cur={cur}
                    waiterConfirm={waiterConfirm}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

type BoardOrder = Prisma.OrderGetPayload<{ include: { table: true; items: true } }>;

function OrderCard({
  o,
  cur,
  waiterConfirm,
}: {
  o: BoardOrder;
  cur: string;
  waiterConfirm: boolean;
}) {
  const next = nextStatus(o.status as OrderStatus);
  const isPlaced = o.status === "PLACED";
  const partial = o.paymentStatus !== "PAID" && toNumber(o.amountPaid) > 0;

  return (
    <div className="flex flex-col rounded-2xl border border-sand-200 bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-ink">
            #{o.orderNumber}
            <span className="ml-2 text-sm font-normal text-ink/45">
              {seatLabel(o.table)}
            </span>
          </p>
          {o.customerName && <p className="text-xs text-ink/55">{o.customerName}</p>}
          <p className="text-[11px] text-ink/40">
            {o.channel === "STAFF"
              ? `Taken by ${o.createdByName ?? "staff"}`
              : "QR self-order"}
          </p>
          {o.presence === "UNVERIFIED" && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
              ⚠ Presence unverified — confirm
            </p>
          )}
        </div>
        <StatusBadge status={o.status} />
      </div>

      <ul className="mt-3 flex-1 space-y-1 text-sm text-ink/80">
        {o.items.map((it) => (
          <li key={it.id} className="flex justify-between gap-2">
            <span>
              <span className="font-medium">{it.quantity}×</span> {it.nameSnapshot}
              {modifierSummary(it.modifiers) && (
                <span className="text-ink/45"> ({modifierSummary(it.modifiers)})</span>
              )}
              {it.notes && <span className="text-ink/45"> · {it.notes}</span>}
            </span>
            <span className="text-ink/55">{formatMoney(toNumber(it.lineTotal), cur)}</span>
          </li>
        ))}
      </ul>

      {o.notes && (
        <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">
          Note: {o.notes}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3">
        <span className="text-sm font-semibold text-ink">
          {formatMoney(toNumber(o.totalAmount), cur)}
        </span>
        <span
          className={`text-xs font-medium ${
            o.paymentStatus === "PAID"
              ? "text-olive-600"
              : partial
                ? "text-amber-600"
                : "text-ink/45"
          }`}
        >
          {o.paymentStatus === "PAID"
            ? "Paid"
            : partial
              ? `${formatMoney(toNumber(o.amountPaid), cur)} paid`
              : "Unpaid"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {isPlaced && waiterConfirm && (
          <>
            <ActionButton
              action={confirmOrderAction}
              fields={{ orderId: o.id }}
              success={`#${o.orderNumber} confirmed`}
              className={BTN.primary}
            >
              Confirm
            </ActionButton>
            <ActionButton
              action={rejectOrderAction}
              fields={{ orderId: o.id }}
              success={`#${o.orderNumber} rejected`}
              confirm={`Reject order #${o.orderNumber}?`}
              className={BTN.danger}
            >
              Reject
            </ActionButton>
          </>
        )}
        {isPlaced && !waiterConfirm && (
          <ActionButton
            action={confirmOrderAction}
            fields={{ orderId: o.id }}
            success={`#${o.orderNumber} sent to kitchen`}
            className={BTN.primary}
          >
            Send to kitchen
          </ActionButton>
        )}
        {next && !isPlaced && (
          <ActionButton
            action={setOrderStatusAction}
            fields={{ orderId: o.id, status: next }}
            success={`#${o.orderNumber} → ${titleCase(next)}`}
            className={BTN.primary}
          >
            {STATUS_ACTION_LABEL[next]}
          </ActionButton>
        )}
        {o.paymentStatus !== "PAID" &&
          (o.status === "SERVED" || o.status === "READY") && (
            <ActionButton
              action={markPaidAction}
              fields={{ orderId: o.id }}
              success={`#${o.orderNumber} marked paid`}
              className={BTN.secondary}
            >
              Mark paid (counter)
            </ActionButton>
          )}
      </div>
    </div>
  );
}
