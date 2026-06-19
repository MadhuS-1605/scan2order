import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { modifierSummary, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { KitchenAlert } from "@/components/admin/kitchen-alert";
import { setOrderStatusAction } from "@/lib/orders/actions";
import { KITCHEN_STATUSES } from "@/lib/orders/status";
import { PrintButton } from "./print-button";

const COLUMNS: {
  status: "CONFIRMED" | "PREPARING" | "READY";
  title: string;
  next: "PREPARING" | "READY" | "SERVED";
  action: string;
  accent: string;
  dot: string;
}[] = [
  {
    status: "CONFIRMED",
    title: "New",
    next: "PREPARING",
    action: "Start preparing",
    accent: "border-l-blue-400",
    dot: "bg-blue-400",
  },
  {
    status: "PREPARING",
    title: "Preparing",
    next: "READY",
    action: "Mark ready",
    accent: "border-l-brand-500",
    dot: "bg-brand-500",
  },
  {
    status: "READY",
    title: "Ready to serve",
    next: "SERVED",
    action: "Mark served",
    accent: "border-l-olive-500",
    dot: "bg-olive-500",
  },
];

function elapsed(from: Date): string {
  const mins = Math.floor((Date.now() - from.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default async function KitchenScreen() {
  const { restaurant } = await getCurrentRestaurant("kitchen");

  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id, status: { in: KITCHEN_STATUSES } },
    orderBy: { confirmedAt: "asc" },
    include: { table: true, items: true },
  });

  // Held orders (awaiting staff confirmation) never reach the kitchen flow —
  // surface a count so kitchen staff know to check the orders board.
  const awaitingCount = await prisma.order.count({
    where: { restaurantId: restaurant.id, status: "PLACED" },
  });

  const config = await prisma.onboardingConfig.findUnique({
    where: { restaurantId: restaurant.id },
    select: { kotPrinterHost: true },
  });
  const hasPrinter = Boolean(config?.kotPrinterHost);

  const grouped = COLUMNS.map((col) => ({
    ...col,
    orders: orders.filter((o) => o.status === col.status),
  }));

  return (
    <div className="space-y-5">
      <LiveStream />
      <KitchenAlert />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-medium text-ink">
          Kitchen <span className="text-ink/40">— {restaurant.name}</span>
        </h1>
        <span className="text-sm text-ink/45">{orders.length} in progress</span>
      </div>

      {awaitingCount > 0 && (
        <Link
          href="/admin/orders"
          className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <span>
            ⚠ {awaitingCount} order{awaitingCount > 1 ? "s" : ""} awaiting
            confirmation — not yet sent to the kitchen
          </span>
          <span className="shrink-0">Review on orders board →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {grouped.map((col) => (
          <div key={col.status}>
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-ink/50">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {col.title}
              </span>
              <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-ink/60">
                {col.orders.length}
              </span>
            </h2>
            <div className="space-y-3">
              {col.orders.length === 0 && (
                <p className="rounded-xl border border-dashed border-sand-300 p-6 text-center text-sm text-ink/35">
                  Nothing here
                </p>
              )}
              {col.orders.map((o) => (
                <div
                  key={o.id}
                  className={`rounded-xl border border-sand-200 border-l-4 bg-surface p-4 ${col.accent}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-2xl text-ink">
                        #{o.orderNumber}
                      </p>
                      <p className="text-xs text-ink/50">
                        {seatLabel(o.table)}
                        {o.customerName && ` · ${o.customerName}`}
                      </p>
                    </div>
                    <span className="text-xs text-ink/40">
                      {elapsed(o.confirmedAt ?? o.createdAt)}
                    </span>
                  </div>

                  <ul className="mt-3 space-y-1">
                    {o.items.map((it) => (
                      <li key={it.id} className="text-base text-ink/90">
                        <span className="font-bold text-ink">
                          {it.quantity}×
                        </span>{" "}
                        {it.nameSnapshot}
                        {modifierSummary(it.modifiers) && (
                          <span className="block pl-6 text-xs text-ink/55">
                            {modifierSummary(it.modifiers)}
                          </span>
                        )}
                        {it.notes && (
                          <span className="block pl-6 text-xs text-brand-700">
                            ↳ {it.notes}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  {o.notes && (
                    <p className="mt-2 rounded bg-brand-50 px-2 py-1 text-xs text-brand-700">
                      {o.notes}
                    </p>
                  )}

                  <form action={setOrderStatusAction} className="mt-3">
                    <input type="hidden" name="orderId" value={o.id} />
                    <input type="hidden" name="status" value={col.next} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 active:translate-y-px"
                    >
                      {col.action}
                    </button>
                  </form>

                  {col.status === "CONFIRMED" && (
                    <PrintButton orderId={o.id} hasPrinter={hasPrinter} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
