import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { LiveStream } from "@/components/live-stream";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";

// Wall-mounted customer monitor: shows order numbers as they move from
// "Preparing" to "Ready" so diners know when to collect / expect their food.
export default async function MonitorScreen() {
  const { restaurant } = await getCurrentRestaurant("monitor");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  const orders = await prisma.order.findMany({
    where: {
      restaurantId: restaurant.id,
      status: { in: ["PREPARING", "READY"] },
    },
    orderBy: { confirmedAt: "asc" },
    select: { id: true, orderNumber: true, status: true },
  });

  const preparing = orders.filter((o) => o.status === "PREPARING");
  const ready = orders.filter((o) => o.status === "READY");

  return (
    <div className="space-y-8">
      <LiveStream />
      <h1 className="text-center font-display text-3xl text-ink">
        {restaurant.name}
      </h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-sand-200 bg-surface p-6">
          <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-brand-600">
            {t(d, "monitor.preparing")}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {preparing.length === 0 ? (
              <p className="py-6 text-ink/30">—</p>
            ) : (
              preparing.map((o) => (
                <span
                  key={o.id}
                  className="rounded-2xl bg-brand-50 px-8 py-6 font-display text-5xl text-brand-700"
                >
                  {o.orderNumber}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-olive-500/30 bg-olive-500/5 p-6">
          <h2 className="mb-5 text-center text-sm font-semibold uppercase tracking-widest text-olive-600">
            {t(d, "monitor.readyPleaseCollect")}
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {ready.length === 0 ? (
              <p className="py-6 text-ink/30">—</p>
            ) : (
              ready.map((o) => (
                <span
                  key={o.id}
                  className="animate-pulse rounded-2xl bg-olive-600 px-8 py-6 font-display text-5xl text-white"
                >
                  {o.orderNumber}
                </span>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
