import Link from "next/link";
import { PartyPopper, Trash2, Users, CalendarDays } from "lucide-react";
import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import {
  setBanquetStatusAction,
  removeBanquetItemAction,
  deleteBanquetAction,
  convertBanquetToKitchenAction,
} from "@/lib/banquets/actions";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { NewBanquetForm, AddPreorderItem } from "./banquets-manager";

const STATUS_STYLES: Record<string, string> = {
  ENQUIRY: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-olive-500/15 text-olive-700",
  CANCELLED: "bg-red-100 text-red-600",
};
const NEXT: Record<string, { labelKey: string; status: string }[]> = {
  ENQUIRY: [
    { labelKey: "banquets.confirm", status: "CONFIRMED" },
    { labelKey: "banquets.decline", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { labelKey: "banquets.markDone", status: "COMPLETED" },
    { labelKey: "banquets.cancel", status: "CANCELLED" },
  ],
  COMPLETED: [],
  CANCELLED: [{ labelKey: "banquets.reopen", status: "CONFIRMED" }],
};

export default async function BanquetsPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

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
          {t(d, "banquets.title")}
        </h1>
        <p className="text-sm text-ink/45">
          {t(d, "banquets.subtitle")}
        </p>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 font-medium text-ink">
          <PartyPopper className="h-4 w-4 text-brand-600" /> {t(d, "banquets.newBooking")}
        </h2>
        <NewBanquetForm />
      </Card>

      {bookings.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/55">
            {t(d, "banquets.emptyState")}{" "}
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
                        {b.guestCount} {t(d, "banquets.pax")}
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
                    {t(d, "banquets.preOrderedMenu")}
                  </p>
                  {b.items.length === 0 ? (
                    <p className="text-xs text-ink/40">{t(d, "banquets.noItemsYet")}</p>
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
                    <span className="text-ink/55">{t(d, "banquets.estTotal")} </span>
                    <span className="font-semibold text-ink">{formatMoney(total, cur)}</span>
                    {advance > 0 && (
                      <span className="text-ink/55">
                        {" "}
                        · {t(d, "banquets.advance")} {formatMoney(advance, cur)} · {t(d, "banquets.balance")}{" "}
                        <span className="font-medium text-ink">{formatMoney(balance, cur)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {b.convertedOrderId ? (
                      <Link
                        href={`/admin/orders/${b.convertedOrderId}`}
                        className="rounded-lg border border-olive-500/40 bg-olive-500/10 px-3 py-1.5 text-xs font-medium text-olive-700 hover:bg-olive-500/20"
                      >
                        ✓ {t(d, "banquets.orderSentView")}
                      </Link>
                    ) : (
                      b.status === "CONFIRMED" &&
                      b.items.length > 0 && (
                        <form action={convertBanquetToKitchenAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <button
                            type="submit"
                            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
                          >
                            {t(d, "banquets.sendToKitchen")}
                          </button>
                        </form>
                      )
                    )}
                    {(NEXT[b.status] ?? []).map((n) => (
                      <form key={n.status} action={setBanquetStatusAction}>
                        <input type="hidden" name="id" value={b.id} />
                        <input type="hidden" name="status" value={n.status} />
                        <button
                          type="submit"
                          className="rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-sand-100"
                        >
                          {t(d, n.labelKey)}
                        </button>
                      </form>
                    ))}
                    <form action={deleteBanquetAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button className="text-ink/30 hover:text-red-600" type="submit" title={t(d, "common.delete")}>
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
