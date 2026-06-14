import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, formatDuration } from "@/lib/utils";
import { Clock } from "lucide-react";
import { StatusBadge } from "@/components/ui";
import { ACTIVE_STATUSES } from "@/lib/orders/status";

export default async function AdminOverview() {
  const { restaurant, config } = await getCurrentRestaurant("overview");
  const rid = restaurant.id;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [ordersToday, paidToday, pending, active, recent] = await Promise.all([
    prisma.order.count({
      where: { restaurantId: rid, createdAt: { gte: startOfToday } },
    }),
    prisma.order.aggregate({
      where: {
        restaurantId: rid,
        paymentStatus: "PAID",
        createdAt: { gte: startOfToday },
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { restaurantId: rid, status: "PLACED" } }),
    prisma.order.count({
      where: { restaurantId: rid, status: { in: ACTIVE_STATUSES } },
    }),
    prisma.order.findMany({
      where: { restaurantId: rid },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { table: true },
    }),
  ]);

  const revenueToday = toNumber(paidToday._sum.totalAmount ?? 0);

  const onShift = config.featureAttendance
    ? await prisma.staffAttendance.findMany({
        where: { restaurantId: rid, clockOutAt: null },
        orderBy: { clockInAt: "asc" },
        include: { adminUser: { select: { name: true, role: true } } },
      })
    : [];
  const now = Date.now();

  const stats = [
    { label: "Orders today", value: String(ordersToday) },
    {
      label: "Revenue today",
      value: formatMoney(revenueToday, restaurant.config!.currency),
    },
    { label: "Awaiting confirmation", value: String(pending), accent: pending > 0 },
    { label: "Active orders", value: String(active) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">Overview</h1>
        <Link
          href="/admin/orders"
          className="text-sm font-medium text-brand-600"
        >
          View all orders →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-sand-200 bg-surface p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
              {s.label}
            </p>
            <p
              className={`mt-2 text-2xl font-bold ${
                s.accent ? "text-brand-600" : "text-ink"
              }`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {config.featureAttendance && (
        <div className="rounded-2xl border border-sand-200 bg-surface">
          <div className="flex items-center justify-between border-b border-sand-100 px-5 py-4">
            <h2 className="font-semibold text-ink">On shift now ({onShift.length})</h2>
            <Link href="/admin/attendance" className="text-sm font-medium text-brand-600">
              Attendance →
            </Link>
          </div>
          {onShift.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-ink/55">
              No one is clocked in right now.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2 px-5 py-4">
              {onShift.map((p) => (
                <li
                  key={p.id}
                  className="inline-flex items-center gap-2 rounded-full border border-olive-200 bg-olive-50 px-3 py-1.5 text-sm text-ink"
                >
                  <Clock className="h-3.5 w-3.5 text-olive-600" />
                  {p.adminUser.name}
                  <span className="text-xs text-ink/45">
                    {formatDuration((now - p.clockInAt.getTime()) / 60_000)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-sand-200 bg-surface">
        <div className="border-b border-sand-100 px-5 py-4">
          <h2 className="font-semibold text-ink">Recent orders</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-ink/55">
            No orders yet. Share your table QR codes to start taking orders.
          </p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {recent.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-ink">
                    #{o.orderNumber}
                    <span className="ml-2 text-ink/45">
                      {o.table?.label ?? "—"}
                    </span>
                    {o.customerName && (
                      <span className="ml-2 text-ink/55">
                        · {o.customerName}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink/45">
                    {o.createdAt.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink/80">
                    {formatMoney(toNumber(o.totalAmount), restaurant.config!.currency)}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
