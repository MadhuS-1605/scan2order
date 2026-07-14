import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { upiPayLink, isValidVpa } from "@/lib/upi";
import { round2 } from "@/lib/pricing";
import { getActiveTableToken } from "@/lib/table-session";
import { CustomerHeader, PoweredBy } from "@/components/customer-header";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import { BillClient } from "@/components/diner/bill-client";


export default async function PaymentPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();
  const tableToken = await getActiveTableToken();

  const entry = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      table: true,
      restaurant: { include: { config: true, group: { select: { name: true } } } },
    },
  });
  if (
    !entry ||
    !entry.table ||
    entry.table.qrToken !== tableToken ||
    !entry.restaurant.config
  ) {
    notFound();
  }
  const qrToken = entry.table.qrToken;

  // Session-based bill: the diner's own rounds (same dining session) consolidate
  // into one bill — scoped to the session, not the whole table, so separate
  // parties at a shared table each pay only their own orders. Includes paid
  // rounds so the bill stays aggregated after settlement. Sessionless (e.g.
  // staff POS) orders fall back to the single order.
  const orders = entry.diningSessionId
    ? await prisma.order.findMany({
        where: {
          restaurantId: entry.restaurantId,
          diningSessionId: entry.diningSessionId,
          status: { not: "CANCELLED" },
        },
        orderBy: { createdAt: "asc" },
        include: { items: true },
      })
    : [
        await prisma.order.findUniqueOrThrow({
          where: { id: entry.id },
          include: { items: true },
        }),
      ];
  const primary = orders[0];

  const config = entry.restaurant.config;
  const cur = config.currency;
  const gstPct = toNumber(config.gstPercentage);

  const subtotal = round2(orders.reduce((s, o) => s + toNumber(o.subtotal), 0));
  const tax = round2(orders.reduce((s, o) => s + toNumber(o.taxAmount), 0));
  const total = round2(orders.reduce((s, o) => s + toNumber(o.totalAmount), 0));
  const tip = toNumber(primary.tipAmount);
  const discount = toNumber(primary.discountAmount);
  const scPct = toNumber(config.serviceChargePercent);
  const serviceCharge = scPct > 0 ? round2((subtotal * scPct) / 100) : 0;
  const payable = round2(Math.max(0, total - discount) + serviceCharge + tip);
  const amountPaid = toNumber(primary.amountPaid);
  const remaining = Math.max(0, round2(payable - amountPaid));
  const paid = primary.paymentStatus === "PAID";
  const isRoom = entry.table?.kind === "ROOM";
  const roomCharged =
    primary.paymentMethod === "ROOM" && primary.paymentStatus === "PENDING";
  const multiRound = orders.length > 1;

  // Split-by-person: group every item across the session by who it belongs
  // to (a manual splitLabel override, else the parent order's customerName,
  // else "Order #N"), then scale each group's raw item subtotal by the same
  // payable/subtotal ratio so it picks up its proportional share of tax,
  // service charge, discount and tip. The last group absorbs the rounding
  // residual so shares always sum exactly to `payable`.
  const groupSubtotals = new Map<string, number>();
  const splitItems: { id: string; label: string; nameSnapshot: string; lineTotal: number }[] = [];
  for (const o of orders) {
    for (const it of o.items) {
      const label = it.splitLabel || o.customerName || `Order #${o.orderNumber}`;
      const lineTotal = toNumber(it.lineTotal);
      groupSubtotals.set(label, (groupSubtotals.get(label) ?? 0) + lineTotal);
      splitItems.push({ id: it.id, label, nameSnapshot: it.nameSnapshot, lineTotal: round2(lineTotal) });
    }
  }
  const splitLabels = [...groupSubtotals.keys()];
  const scaleRatio = subtotal > 0 ? payable / subtotal : 0;
  const shares = splitLabels.map((label) => round2(groupSubtotals.get(label)! * scaleRatio));
  if (shares.length > 0) {
    const sumAllButLast = shares.slice(0, -1).reduce((s, v) => s + v, 0);
    shares[shares.length - 1] = round2(payable - sumAllButLast);
  }
  const peopleBreakdown = splitLabels.map((label, i) => ({
    label,
    itemSubtotal: round2(groupSubtotals.get(label)!),
    share: shares[i],
  }));

  let upiQr: string | null = null;
  let upiLink: string | null = null;
  if (config.upiId && isValidVpa(config.upiId) && !paid && remaining > 0) {
    upiLink = upiPayLink({
      vpa: config.upiId,
      name: config.upiName ?? entry.restaurant.name,
      amount: remaining,
      note: `Bill #${primary.orderNumber}`,
    });
    upiQr = await QRCode.toDataURL(upiLink, { margin: 1, width: 320 });
  }

  return (
    <div className="min-h-screen bg-grain">
      <CustomerHeader
        restaurantName={entry.restaurant.name}
        groupName={entry.restaurant.group?.name}
        seat={seatLabel(entry.table)}
        logoUrl={entry.restaurant.logoUrl}
      />
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24 sm:py-8 sm:pb-24">
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl text-ink">Your bill</h1>
              <p className="text-xs text-ink/45">{entry.restaurant.name}</p>
            </div>
            <span className="rounded-full bg-sand-100 px-2.5 py-1 text-xs font-medium text-ink/60">
              {seatLabel(entry.table)}
              {multiRound ? ` · ${orders.length} rounds` : ` · #${primary.orderNumber}`}
            </span>
          </div>

          {orders.map((o) => (
            <div key={o.id} className="mt-4">
              {multiRound && (
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-ink/40">
                  Order #{o.orderNumber}
                </p>
              )}
              <ul className="space-y-1.5 text-sm text-ink/80">
                {o.items.map((it) => (
                  <li key={it.id} className="flex justify-between">
                    <span>
                      {it.quantity}× {it.nameSnapshot}
                      {modifierSummary(it.modifiers) && (
                        <span className="text-ink/45">
                          {" "}
                          ({modifierSummary(it.modifiers)})
                        </span>
                      )}
                    </span>
                    <span>{formatMoney(toNumber(it.lineTotal), cur)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="mt-4 space-y-1 border-t border-sand-100 pt-3 text-sm">
            {primary.gstMode !== "NONE" && (
              <>
                <Row
                  label={primary.gstMode === "INCLUSIVE" ? "Taxable value" : "Subtotal"}
                  value={formatMoney(subtotal, cur)}
                />
                <Row label={`GST (${gstPct}%)`} value={formatMoney(tax, cur)} />
              </>
            )}
            <Row label="Total" value={formatMoney(total, cur)} />
            {discount > 0 && (
              <Row
                label={`Discount${primary.couponCode ? ` (${primary.couponCode})` : ""}`}
                value={`− ${formatMoney(discount, cur)}`}
              />
            )}
            {serviceCharge > 0 && (
              <Row label={`Service charge (${scPct}%)`} value={formatMoney(serviceCharge, cur)} />
            )}
            {tip > 0 && <Row label="Tip" value={formatMoney(tip, cur)} />}
            <Row label="Amount payable" value={formatMoney(payable, cur)} bold />
            {amountPaid > 0 && !paid && (
              <Row
                label="Paid so far"
                value={`${formatMoney(amountPaid, cur)} · ${formatMoney(remaining, cur)} left`}
              />
            )}
            {primary.gstMode === "INCLUSIVE" && (
              <p className="pt-1 text-xs text-ink/45">Total is inclusive of GST.</p>
            )}
          </div>
        </div>

        <BillClient
          orderId={entry.id}
          qrToken={qrToken}
          restaurantId={entry.restaurantId}
          paid={paid}
          total={total}
          tip={tip}
          discount={discount}
          couponCode={primary.couponCode}
          payable={payable}
          amountPaid={amountPaid}
          remaining={remaining}
          currency={cur}
          restaurantName={entry.restaurant.name}
          onlineEnabled={config.onlinePaymentEnabled}
          counterEnabled={config.counterPaymentEnabled}
          isRoom={isRoom}
          roomCharged={roomCharged}
          roomLabel={entry.table?.label ?? ""}
          upiQr={upiQr}
          upiLink={upiLink}
          pdfUrl={`/api/bill/${primary.id}/pdf?t=${qrToken}`}
          peopleBreakdown={peopleBreakdown}
          splitItems={splitItems}
        />
        <PoweredBy />
      </div>
      <CustomerTabBar />
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "font-semibold text-ink" : "text-ink/55"}>{label}</span>
      <span className={bold ? "font-bold text-ink" : "text-ink/80"}>{value}</span>
    </div>
  );
}
