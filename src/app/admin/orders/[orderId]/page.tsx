import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { hasPermission } from "@/lib/auth/permissions";
import { StatusBadge, Card, Select, Button } from "@/components/ui";
import { changeOrderTableAction } from "@/lib/orders/actions";
import { OrderItemsEditor } from "./order-items-editor";
import { RefundForm } from "./refund-form";

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className={bold ? "font-semibold text-ink" : "text-ink/55"}>{label}</span>
      <span className={bold ? "font-bold text-ink" : "text-ink/80"}>{value}</span>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { restaurant, config, session } = await getCurrentRestaurant("orders");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const cur = config.currency;

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: {
      table: true,
      items: true,
      refunds: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!order) notFound();

  // Staff may edit items while the order is open and unpaid.
  const editable = order.paymentStatus !== "PAID" && order.status !== "CANCELLED";
  const menu = editable
    ? await prisma.menuItem.findMany({
        where: { restaurantId: restaurant.id, isAvailable: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const tables = editable
    ? await prisma.restaurantTable.findMany({
        where: { restaurantId: restaurant.id, isActive: true },
        orderBy: { label: "asc" },
        select: { id: true, label: true, kind: true },
      })
    : [];

  const subtotal = toNumber(order.subtotal);
  const tax = toNumber(order.taxAmount);
  const total = toNumber(order.totalAmount);
  const discount = toNumber(order.discountAmount);
  const tip = toNumber(order.tipAmount);
  const paid = toNumber(order.amountPaid);
  // Refunds: how much has gone back, and what's left to refund on this order.
  const refunded = order.refunds
    .filter((r) => r.status === "DONE")
    .reduce((s, r) => s + toNumber(r.amount), 0);
  const refundable = Math.max(0, Math.round((paid - refunded) * 100) / 100);
  const canExecuteRefund = hasPermission(session.role, "refunds");
  const canRefund =
    (canExecuteRefund || hasPermission(session.role, "requestRefunds")) && refundable > 0;

  const timeline: { label: string; at: Date | null }[] = [
    { label: t(d, "orderDetail.placed"), at: order.placedAt ?? order.createdAt },
    { label: t(d, "orderDetail.confirmed"), at: order.confirmedAt },
    { label: t(d, "orderDetail.ready"), at: order.readyAt },
    { label: t(d, "orderDetail.served"), at: order.servedAt },
    { label: t(d, "orderDetail.closed"), at: order.closedAt },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">
            {t(d, "orderDetail.order")} #{order.orderNumber}
          </h1>
          <p className="text-sm text-ink/45">
            {order.createdAt.toLocaleString("en-IN")} · {seatLabel(order.table)}
          </p>
        </div>
        <Link
          href="/admin/orders/history"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> {t(d, "common.back")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={order.status} />
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            order.paymentStatus === "PAID"
              ? "bg-olive-500/15 text-olive-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {order.paymentStatus === "PAID"
            ? `${t(d, "orderDetail.paid")} · ${order.paymentMethod ?? ""}`
            : order.paymentStatus}
        </span>
        {order.customerName && (
          <span className="text-sm text-ink/60">{order.customerName}</span>
        )}
        {order.customerPhone && (
          <span className="text-sm text-ink/45">{order.customerPhone}</span>
        )}
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            order.channel === "STAFF"
              ? "bg-brand-50 text-brand-700"
              : "bg-sand-100 text-ink/55"
          }`}
        >
          {order.channel === "STAFF"
            ? `${t(d, "orderDetail.takenBy")} ${order.createdByName ?? t(d, "orderDetail.staff")}`
            : t(d, "orderDetail.qrSelfOrder")}
        </span>
        {order.channel === "CUSTOMER" && order.presence === "UNVERIFIED" && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            ⚠ {t(d, "orderDetail.presenceUnverified")}
          </span>
        )}
        {order.channel === "CUSTOMER" &&
          order.presence === "VERIFIED" &&
          order.distanceM != null && (
            <span className="rounded-full bg-olive-500/15 px-2.5 py-1 text-xs font-medium text-olive-700">
              ✓ {t(d, "orderDetail.atVenue")} (~{order.distanceM} m)
            </span>
          )}
        {order.fulfillment !== "DINE_IN" && (
          <span className="rounded-full bg-brand-600 px-2.5 py-1 text-xs font-medium text-white">
            {order.fulfillment === "DELIVERY"
              ? `🛵 ${t(d, "orderDetail.delivery")}`
              : `🥡 ${t(d, "orderDetail.pickup")}`}
          </span>
        )}
      </div>

      {order.fulfillment === "DELIVERY" && order.deliveryAddress && (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-ink/80">
          <span className="font-medium text-ink">{t(d, "orderDetail.deliverTo")}:</span> {order.deliveryAddress}
        </div>
      )}

      {editable && tables.length > 1 && (
        <form
          action={changeOrderTableAction}
          className="flex flex-wrap items-end gap-3 rounded-xl border border-sand-200 bg-surface p-3"
        >
          <input type="hidden" name="orderId" value={order.id} />
          <div>
            <label
              htmlFor="newTableId"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/55"
            >
              {t(d, "orderDetail.moveToTable")}
            </label>
            <Select id="newTableId" name="newTableId" required defaultValue="" className="w-40">
              <option value="" disabled>
                {t(d, "orderDetail.selectPlaceholder")}
              </option>
              {tables
                .filter((tbl) => tbl.id !== order.tableId)
                .map((tbl) => (
                  <option key={tbl.id} value={tbl.id}>
                    {tbl.kind === "ROOM" ? `${t(d, "orderDetail.room")} ${tbl.label}` : tbl.label}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1 text-sm text-ink/70">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="scope" value="all" defaultChecked />
              {t(d, "orderDetail.wholeParty")}
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="scope" value="single" />
              {t(d, "orderDetail.justThisOrder")}
            </label>
          </div>
          <Button type="submit" variant="secondary">
            {t(d, "orderDetail.move")}
          </Button>
        </form>
      )}

      {(canRefund || order.refunds.length > 0) && (
        <Card>
          <h2 className="mb-1 font-semibold text-ink">{t(d, "orderDetail.refunds")}</h2>
          {paid > 0 && (
            <p className="text-sm text-ink/55">
              {t(d, "orderDetail.paid")} {formatMoney(paid, cur)}
              {refunded > 0 && ` · ${t(d, "orderDetail.refundedLabel")} ${formatMoney(refunded, cur)}`}
              {refundable > 0
                ? ` · ${formatMoney(refundable, cur)} ${t(d, "orderDetail.refundableLabel")}`
                : refunded > 0
                  ? ` · ${t(d, "orderDetail.fullyRefunded")}`
                  : ""}
            </p>
          )}
          {order.refunds.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {order.refunds.map((r) => (
                <li key={r.id} className="flex justify-between gap-3">
                  <span className="text-ink/70">
                    {formatMoney(toNumber(r.amount), cur)} · {r.method}
                    {r.status === "FAILED" && (
                      <span className="ml-1 text-red-600">{t(d, "orderDetail.failed")}</span>
                    )}
                    {r.status === "PENDING" && (
                      <span className="ml-1 text-amber-600">awaiting approval</span>
                    )}
                    {r.status === "REJECTED" && (
                      <span className="ml-1 text-ink/40">declined</span>
                    )}
                    {r.reason ? ` · ${r.reason}` : ""}
                    {r.createdByName ? ` · ${r.createdByName}` : ""}
                  </span>
                  <span className="shrink-0 text-ink/40">
                    {r.createdAt.toLocaleDateString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canRefund && (
            <div className="mt-3 border-t border-sand-100 pt-3">
              <RefundForm
                orderId={order.id}
                refundable={refundable}
                currency={cur}
                online={order.paymentMethod === "ONLINE"}
                canExecute={canExecuteRefund}
              />
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-ink">{t(d, "orderDetail.items")}</h2>
            {editable && (
              <span className="text-xs text-ink/40">{t(d, "orderDetail.tapToAdjust")}</span>
            )}
          </div>
          {editable ? (
            <OrderItemsEditor
              orderId={order.id}
              currency={cur}
              menu={menu}
              items={order.items.map((it) => ({
                id: it.id,
                nameSnapshot: it.nameSnapshot,
                quantity: it.quantity,
                lineTotal: toNumber(it.lineTotal),
                notes: it.notes,
              }))}
            />
          ) : (
            <ul className="space-y-2 text-sm">
              {order.items.map((it) => {
                const mods = modifierSummary(it.modifiers);
                return (
                  <li key={it.id} className="flex justify-between">
                    <span className="text-ink/80">
                      {it.quantity}× {it.nameSnapshot}
                      {mods && <span className="block text-xs text-ink/45">{mods}</span>}
                      {it.notes && (
                        <span className="block text-xs text-brand-700">↳ {it.notes}</span>
                      )}
                    </span>
                    <span className="text-ink/70">
                      {formatMoney(toNumber(it.lineTotal), cur)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 space-y-1 border-t border-sand-100 pt-3">
            {order.gstMode !== "NONE" && (
              <>
                <Row label={t(d, "orderDetail.subtotal")} value={formatMoney(subtotal, cur)} />
                <Row label={t(d, "orderDetail.gst")} value={formatMoney(tax, cur)} />
              </>
            )}
            {discount > 0 && (
              <Row
                label={
                  order.couponCode
                    ? `${t(d, "orderDetail.discount")} (${order.couponCode})`
                    : t(d, "orderDetail.discount")
                }
                value={"- " + formatMoney(discount, cur)}
              />
            )}
            {tip > 0 && <Row label={t(d, "orderDetail.tip")} value={formatMoney(tip, cur)} />}
            <Row label={t(d, "common.total")} value={formatMoney(total, cur)} bold />
            <Row label={t(d, "orderDetail.amountPaid")} value={formatMoney(paid, cur)} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium text-ink">{t(d, "orderDetail.timeline")}</h2>
          <ul className="space-y-2">
            {timeline.map((row) => (
              <li key={row.label} className="flex justify-between text-sm">
                <span className="text-ink/55">{row.label}</span>
                <span className={row.at ? "text-ink/80" : "text-ink/30"}>
                  {row.at
                    ? row.at.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </span>
              </li>
            ))}
          </ul>
          {order.notes && (
            <p className="mt-3 rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink/70">
              {order.notes}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
