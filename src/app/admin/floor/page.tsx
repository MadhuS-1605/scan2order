import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { FreeTableActions } from "@/components/admin/free-table";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";

function fmtIdle(mins: number, d: ReturnType<typeof dictFor>): string {
  if (mins < 1) return t(d, "floor.justNow");
  return mins < 60
    ? `${mins}${t(d, "floor.mAgo")}`
    : `${Math.floor(mins / 60)}h ${mins % 60}m ${t(d, "floor.ago")}`;
}

export default async function FloorPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  const [tables, open] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, label: true, kind: true, posX: true, posY: true },
    }),
    // Open (unpaid, non-cancelled) orders define which tables are occupied.
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { not: "CANCELLED" },
        paymentStatus: { not: "PAID" },
        tableId: { not: null },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, tableId: true, totalAmount: true, createdAt: true },
    }),
  ]);

  const now = Date.now();
  const byTable = new Map<string, typeof open>();
  for (const o of open) {
    if (!o.tableId) continue;
    const arr = byTable.get(o.tableId) ?? [];
    arr.push(o);
    byTable.set(o.tableId, arr);
  }

  const occupiedCount = byTable.size;

  return (
    <div className="space-y-5">
      <LiveStream />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "floor.title")}</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink/45">
            {occupiedCount} {t(d, "floor.occupiedLower")} · {tables.length - occupiedCount} {t(d, "floor.freeLower")}
          </span>
          <Link
            href="/admin/floor/layout"
            className="rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:border-brand-300"
          >
            Edit layout
          </Link>
        </div>
      </div>

      {tables.some((tbl) => tbl.posX !== null && tbl.posY !== null) && (
        <div className="relative aspect-[4/3] w-full max-w-2xl rounded-2xl border border-sand-200 bg-sand-100/40">
          {tables
            .filter((tbl) => tbl.posX !== null && tbl.posY !== null)
            .map((tbl) => {
              const occupied = byTable.has(tbl.id);
              return (
                <div
                  key={tbl.id}
                  className={`absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border text-[10px] font-medium ${
                    occupied
                      ? "border-brand-400 bg-brand-500 text-white"
                      : "border-sand-300 bg-surface text-ink/70"
                  }`}
                  style={{ left: `${tbl.posX}%`, top: `${tbl.posY}%` }}
                  title={seatLabel(tbl)}
                >
                  {tbl.label}
                </div>
              );
            })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((tbl) => {
          const list = byTable.get(tbl.id) ?? [];
          const occupied = list.length > 0;
          const total = list.reduce((s, o) => s + toNumber(o.totalAmount), 0);
          const newest = occupied
            ? Math.max(...list.map((o) => o.createdAt.getTime()))
            : 0;
          const anyOrderId = list[0]?.id;

          return (
            <div
              key={tbl.id}
              className={`flex flex-col rounded-2xl border p-4 ${
                occupied
                  ? "border-brand-300 bg-brand-50"
                  : "border-sand-200 bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg text-ink">
                  {seatLabel(tbl)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    occupied
                      ? "bg-brand-600 text-white"
                      : "bg-olive-500/15 text-olive-700"
                  }`}
                >
                  {occupied ? t(d, "floor.occupied") : t(d, "floor.free")}
                </span>
              </div>

              {occupied ? (
                <>
                  <p className="mt-2 font-display text-2xl text-ink">
                    {formatMoney(total, cur)}
                  </p>
                  <p className="text-xs text-ink/55">
                    {list.length}{" "}
                    {list.length > 1 ? t(d, "floor.orders") : t(d, "floor.order")} ·{" "}
                    {t(d, "floor.last")}{" "}
                    {fmtIdle(Math.floor((now - newest) / 60000), d)}
                  </p>
                  <FreeTableActions
                    tableId={tbl.id}
                    anyOrderId={anyOrderId ?? ""}
                    label={seatLabel(tbl)}
                    total={total}
                    currency={cur}
                  />
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/40">{t(d, "floor.available")}</p>
              )}
            </div>
          );
        })}
      </div>

      {tables.length === 0 && (
        <p className="rounded-2xl border border-dashed border-sand-300 bg-surface p-12 text-center text-sm text-ink/55">
          {t(d, "floor.noTablesYet")}
        </p>
      )}
    </div>
  );
}
