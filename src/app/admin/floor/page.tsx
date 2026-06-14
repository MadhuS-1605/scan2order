import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";
import { FreeTableActions } from "@/components/admin/free-table";

function fmtIdle(mins: number): string {
  if (mins < 1) return "just now";
  return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default async function FloorPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const [tables, open] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { label: "asc" },
      select: { id: true, label: true, kind: true },
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
        <h1 className="font-display text-3xl font-medium text-ink">Floor</h1>
        <span className="text-sm text-ink/45">
          {occupiedCount} occupied · {tables.length - occupiedCount} free
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => {
          const list = byTable.get(t.id) ?? [];
          const occupied = list.length > 0;
          const total = list.reduce((s, o) => s + toNumber(o.totalAmount), 0);
          const newest = occupied
            ? Math.max(...list.map((o) => o.createdAt.getTime()))
            : 0;
          const anyOrderId = list[0]?.id;

          return (
            <div
              key={t.id}
              className={`flex flex-col rounded-2xl border p-4 ${
                occupied
                  ? "border-brand-300 bg-brand-50"
                  : "border-sand-200 bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg text-ink">
                  {seatLabel(t)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    occupied
                      ? "bg-brand-600 text-white"
                      : "bg-olive-500/15 text-olive-700"
                  }`}
                >
                  {occupied ? "Occupied" : "Free"}
                </span>
              </div>

              {occupied ? (
                <>
                  <p className="mt-2 font-display text-2xl text-ink">
                    {formatMoney(total, cur)}
                  </p>
                  <p className="text-xs text-ink/55">
                    {list.length} order{list.length > 1 ? "s" : ""} · last{" "}
                    {fmtIdle(Math.floor((now - newest) / 60000))}
                  </p>
                  <FreeTableActions
                    tableId={t.id}
                    anyOrderId={anyOrderId ?? ""}
                    label={seatLabel(t)}
                    total={total}
                    currency={cur}
                  />
                </>
              ) : (
                <p className="mt-2 text-sm text-ink/40">Available</p>
              )}
            </div>
          );
        })}
      </div>

      {tables.length === 0 && (
        <p className="rounded-2xl border border-dashed border-sand-300 bg-surface p-12 text-center text-sm text-ink/55">
          No tables yet. Add tables in Tables &amp; QR.
        </p>
      )}
    </div>
  );
}
