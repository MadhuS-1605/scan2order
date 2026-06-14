import { PartyPopper, Trash2, Users, CalendarDays } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import {
  setBanquetStatusAction,
  removeBanquetItemAction,
  deleteBanquetAction,
} from "@/lib/banquets/actions";
import { Card } from "@/components/ui";
import { NewBanquetForm, AddPreorderItem } from "./banquets-manager";

const STATUS_STYLES: Record<string, string> = {
  ENQUIRY: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-olive-500/15 text-olive-700",
  CANCELLED: "bg-red-100 text-red-600",
};
const NEXT: Record<string, { label: string; status: string }[]> = {
  ENQUIRY: [
    { label: "Confirm", status: "CONFIRMED" },
    { label: "Decline", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Mark done", status: "COMPLETED" },
    { label: "Cancel", status: "CANCELLED" },
  ],
  COMPLETED: [],
  CANCELLED: [{ label: "Reopen", status: "CONFIRMED" }],
};

export default async function BanquetsPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const [bookings, menuItems] = await Promise.all([
    prisma.banquetBooking.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { eventDate: "asc" },
      include: { items: true },
    }),
    prisma.menuItem.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, price: true },
    }),
  ]);
  const menu = menuItems.map((m) => ({ id: m.id, name: m.name, price: toNumber(m.price) }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">
          Banquets &amp; events
        </h1>
        <p className="text-sm text-ink/45">
          Function-hall bookings, parties and corporate events — with a pre-agreed
          menu and advance.
        </p>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
          <PartyPopper className="h-4 w-4 text-brand-600" /> New booking
        </h2>
        <NewBanquetForm />
      </Card>

      {bookings.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/55">
            No bookings yet. Add one above, or share your enquiry page:{" "}
            <span className="font-medium text-ink/70">/banquet/{restaurant.slug}</span>
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const total = b.items.reduce(
              (s, it) => s + toNumber(it.priceSnapshot) * it.quantity,
              0,
            );
            const advance = toNumber(b.advanceAmount);
            const balance = Math.max(0, total - advance);
            return (
              <Card key={b.id} className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">
                      {b.eventType}
                      <span className="ml-2 text-ink/50">· {b.customerName}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-ink/55">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {b.eventDate.toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {b.guestCount} pax
                      </span>
                      {b.hall && <span>· {b.hall}</span>}
                      <span>· {b.customerPhone}</span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      STATUS_STYLES[b.status] ?? "bg-sand-100 text-ink/60"
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                {b.notes && (
                  <p className="rounded-lg bg-sand-100 px-3 py-2 text-xs text-ink/70">
                    {b.notes}
                  </p>
                )}

                {/* Pre-order menu */}
                <div className="rounded-lg border border-sand-200 p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">
                    Pre-ordered menu
                  </p>
                  {b.items.length === 0 ? (
                    <p className="text-xs text-ink/40">No items added yet.</p>
                  ) : (
                    <ul className="mb-2 space-y-1 text-sm">
                      {b.items.map((it) => (
                        <li key={it.id} className="flex items-center justify-between">
                          <span className="text-ink/80">
                            {it.quantity}× {it.nameSnapshot}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="text-ink/70">
                              {formatMoney(toNumber(it.priceSnapshot) * it.quantity, cur)}
                            </span>
                            <form action={removeBanquetItemAction}>
                              <input type="hidden" name="id" value={it.id} />
                              <button className="text-ink/30 hover:text-red-600" type="submit">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </form>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <AddPreorderItem bookingId={b.id} menu={menu} />
                </div>

                {/* Money + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-sand-100 pt-3">
                  <div className="text-sm">
                    <span className="text-ink/55">Est. total </span>
                    <span className="font-semibold text-ink">{formatMoney(total, cur)}</span>
                    {advance > 0 && (
                      <span className="text-ink/55">
                        {" "}
                        · advance {formatMoney(advance, cur)} · balance{" "}
                        <span className="font-medium text-ink">{formatMoney(balance, cur)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {(NEXT[b.status] ?? []).map((n) => (
                      <form key={n.status} action={setBanquetStatusAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="status" value={n.status} />
                        <button
                          type="submit"
                          className="rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-sand-100"
                        >
                          {n.label}
                        </button>
                      </form>
                    ))}
                    <form action={deleteBanquetAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-ink/30 hover:text-red-600" type="submit" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
