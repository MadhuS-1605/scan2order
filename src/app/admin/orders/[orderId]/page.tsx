import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { StatusBadge, Card, Select, Button } from "@/components/ui";
import { changeOrderTableAction } from "@/lib/orders/actions";
import { OrderItemsEditor } from "./order-items-editor";

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
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, items: true },
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

  const timeline: { label: string; at: Date | null }[] = [
    { label: "Placed", at: order.placedAt ?? order.createdAt },
    { label: "Confirmed", at: order.confirmedAt },
    { label: "Ready", at: order.readyAt },
    { label: "Served", at: order.servedAt },
    { label: "Closed", at: order.closedAt },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">
            Order #{order.orderNumber}
          </h1>
          <p className="text-sm text-ink/45">
            {order.createdAt.toLocaleString("en-IN")} · {seatLabel(order.table)}
          </p>
        </div>
        <Link
          href="/admin/orders/history"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back
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
            ? `Paid · ${order.paymentMethod ?? ""}`
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
            ? `Taken by ${order.createdByName ?? "staff"}`
            : "QR self-order"}
        </span>
        {order.channel === "CUSTOMER" && order.presence === "UNVERIFIED" && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
            ⚠ Presence unverified
          </span>
        )}
        {order.channel === "CUSTOMER" &&
          order.presence === "VERIFIED" &&
          order.distanceM != null && (
            <span className="rounded-full bg-olive-500/15 px-2.5 py-1 text-xs font-medium text-olive-700">
              ✓ At venue (~{order.distanceM} m)
            </span>
          )}
      </div>

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
              Move to table
            </label>
            <Select id="newTableId" name="newTableId" required defaultValue="" className="w-40">
              <option value="" disabled>
                Select…
              </option>
              {tables
                .filter((t) => t.id !== order.tableId)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.kind === "ROOM" ? `Room ${t.label}` : t.label}
                  </option>
                ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1 text-sm text-ink/70">
            <label className="flex items-center gap-1.5">
              <input type="radio" name="scope" value="all" defaultChecked />
              Whole party (all open orders at this table)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" name="scope" value="single" />
              Just this order
            </label>
          </div>
          <Button type="submit" variant="secondary">
            Move
          </Button>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium text-ink">Items</h2>
            {editable && (
              <span className="text-xs text-ink/40">Tap ± to adjust</span>
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
                <Row label="Subtotal" value={formatMoney(subtotal, cur)} />
                <Row label="GST" value={formatMoney(tax, cur)} />
              </>
            )}
            {discount > 0 && (
              <Row
                label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
                value={"- " + formatMoney(discount, cur)}
              />
            )}
            {tip > 0 && <Row label="Tip" value={formatMoney(tip, cur)} />}
            <Row label="Total" value={formatMoney(total, cur)} bold />
            <Row label="Amount paid" value={formatMoney(paid, cur)} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium text-ink">Timeline</h2>
          <ul className="space-y-2">
            {timeline.map((t) => (
              <li key={t.label} className="flex justify-between text-sm">
                <span className="text-ink/55">{t.label}</span>
                <span className={t.at ? "text-ink/80" : "text-ink/30"}>
                  {t.at
                    ? t.at.toLocaleString("en-IN", {
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
