import { redirect } from "next/navigation";
import { Wine } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { modifierSummary, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { ACTIVE_STATUSES } from "@/lib/orders/status";
import { toggleItemPreparedAction } from "@/lib/orders/actions";

// Bar counter KDS — a prep board of drink (BAR-station) items across open
// orders. Bar staff tick each drink "Ready" (a per-item ack, independent of the
// overall order status which stays with the kitchen/floor). Enabled per-venue
// via the Bar module.
export default async function BarScreen() {
  const { restaurant, config } = await getCurrentRestaurant("kitchen");
  if (!config.featureBar) redirect("/admin");

  const orders = await prisma.order.findMany({
    where: { restaurantId: restaurant.id, status: { in: ACTIVE_STATUSES } },
    orderBy: { confirmedAt: "asc" },
    include: {
      table: true,
      items: { include: { menuItem: { select: { category: { select: { station: true } } } } } },
    },
  });

  // Keep only orders that have at least one BAR-station item; show just those.
  const tickets = orders
    .map((o) => ({
      order: o,
      barItems: o.items.filter(
        (it) => it.menuItem?.category?.station === "BAR",
      ),
    }))
    .filter((t) => t.barItems.length > 0);

  return (
    <div className="space-y-5">
      <LiveStream />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 font-display text-3xl font-medium text-ink">
          <Wine className="h-7 w-7 text-brand-600" strokeWidth={1.75} />
          Bar counter
        </h1>
        <span className="text-sm text-ink/45">{tickets.length} to pour</span>
      </div>

      {tickets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand-300 p-10 text-center text-sm text-ink/40">
          No drink orders right now. Tag drink categories as “Bar” in Menu so
          their orders appear here.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tickets.map(({ order, barItems }) => (
            <div
              key={order.id}
              className="rounded-xl border border-sand-200 border-l-4 border-l-brand-500 bg-surface p-4"
            >
              <div className="flex items-start justify-between">
                <p className="font-display text-2xl text-ink">#{order.orderNumber}</p>
                <span className="text-xs text-ink/50">{seatLabel(order.table)}</span>
              </div>
              <ul className="mt-3 space-y-1.5">
                {barItems.map((it) => (
                  <li
                    key={it.id}
                    className={`flex items-start justify-between gap-2 ${it.preparedAt ? "opacity-45" : ""}`}
                  >
                    <span className="text-base text-ink/90">
                      <span className={it.preparedAt ? "line-through" : "font-bold text-ink"}>
                        {it.quantity}× {it.nameSnapshot}
                      </span>
                      {modifierSummary(it.modifiers) && (
                        <span className="block pl-6 text-xs text-ink/55">
                          {modifierSummary(it.modifiers)}
                        </span>
                      )}
                      {it.notes && (
                        <span className="block pl-6 text-xs text-brand-700">↳ {it.notes}</span>
                      )}
                    </span>
                    <form action={toggleItemPreparedAction}>
                      <input type="hidden" name="itemId" value={it.id} />
                      <button
                        type="submit"
                        className={`shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                          it.preparedAt
                            ? "border-sand-300 text-ink/55 hover:bg-sand-100"
                            : "border-olive-500/40 bg-olive-500/10 text-olive-700 hover:bg-olive-500/20"
                        }`}
                      >
                        {it.preparedAt ? "Undo" : "Ready"}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
