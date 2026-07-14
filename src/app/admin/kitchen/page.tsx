import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { modifierSummary, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { KitchenAlert } from "@/components/admin/kitchen-alert";
import { setOrderStatusAction } from "@/lib/orders/actions";
import { KITCHEN_STATUSES } from "@/lib/orders/status";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { formatDuration } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { StatusActionButton } from "./status-action-button";

const COLUMNS: {
  status: "CONFIRMED" | "PREPARING" | "READY";
  titleKey: string;
  next: "PREPARING" | "READY" | "SERVED";
  actionKey: string;
  accent: string;
  dot: string;
}[] = [
  {
    status: "CONFIRMED",
    titleKey: "kitchen.colNew",
    next: "PREPARING",
    actionKey: "kitchen.startPreparing",
    accent: "border-l-brand-300",
    dot: "bg-brand-300",
  },
  {
    status: "PREPARING",
    titleKey: "kitchen.colPreparing",
    next: "READY",
    actionKey: "kitchen.markReady",
    accent: "border-l-brand-500",
    dot: "bg-brand-500",
  },
  {
    status: "READY",
    titleKey: "kitchen.colReadyToServe",
    next: "SERVED",
    actionKey: "kitchen.markServed",
    accent: "border-l-olive-500",
    dot: "bg-olive-500",
  },
];

function elapsed(from: Date, d: ReturnType<typeof dictFor>): string {
  const mins = Math.floor((Date.now() - from.getTime()) / 60000);
  if (mins < 1) return t(d, "kitchen.justNow");
  if (mins < 60) return `${mins} ${t(d, "kitchen.min")}`;
  return formatDuration(mins);
}

export default async function KitchenScreen() {
  const { restaurant } = await getCurrentRestaurant("kitchen");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

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
          {t(d, "kitchen.title")} <span className="text-ink/40">— {restaurant.name}</span>
        </h1>
        <span className="text-sm text-ink/45">{orders.length} {t(d, "kitchen.inProgress")}</span>
      </div>

      {awaitingCount > 0 && (
        <Link
          href="/admin/orders"
          className="flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100"
        >
          <span>
            ⚠ {awaitingCount}{" "}
            {awaitingCount > 1
              ? t(d, "kitchen.ordersAwaitingConfirmation")
              : t(d, "kitchen.orderAwaitingConfirmation")}
          </span>
          <span className="shrink-0">{t(d, "kitchen.reviewOnOrdersBoard")} →</span>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {grouped.map((col) => (
          <div key={col.status}>
            <h2 className="mb-3 flex items-center justify-between text-sm font-semibold uppercase tracking-wide text-ink/50">
              <span className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                {t(d, col.titleKey)}
              </span>
              <span className="rounded-full bg-sand-200 px-2 py-0.5 text-xs text-ink/60">
                {col.orders.length}
              </span>
            </h2>
            <div className="space-y-3">
              {col.orders.length === 0 && (
                <p className="rounded-xl border border-dashed border-sand-300 p-6 text-center text-sm text-ink/35">
                  {t(d, "kitchen.nothingHere")}
                </p>
              )}
              {col.orders.map((o) => (
                <div
                  key={o.id}
                  className={`animate-ticket-in rounded-xl border border-sand-200 border-l-4 bg-surface p-4 ${col.accent}`}
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
                      {elapsed(o.confirmedAt ?? o.createdAt, d)}
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
                    <StatusActionButton label={t(d, col.actionKey)} />
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
