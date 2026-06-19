import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, seatLabel } from "@/lib/utils";
import { StatusBadge, Card } from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";

const PAGE_SIZE = 50;

export default async function OrderHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { restaurant, config } = await getCurrentRestaurant("orders");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const cur = config.currency;
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { table: true, _count: { select: { items: true } } },
    }),
    prisma.order.count({
      where: {
        restaurantId: restaurant.id,
        status: { in: ["COMPLETED", "CANCELLED"] },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium text-ink">
            {t(d, "history.pastOrders")}
          </h1>
          <p className="text-sm text-ink/45">{t(d, "history.subtitle")}</p>
        </div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> {t(d, "history.liveOrders")}
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/55">{t(d, "history.empty")}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-sand-100/60"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      #{o.orderNumber}
                      <span className="ml-2 text-sm font-normal text-ink/50">
                        {seatLabel(o.table)}
                        {o.customerName ? ` · ${o.customerName}` : ""}
                      </span>
                    </p>
                    <p className="text-xs text-ink/45">
                      {o.createdAt.toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {o._count.items}{" "}
                      {o._count.items > 1
                        ? t(d, "history.items")
                        : t(d, "history.item")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-right">
                      <span className="block font-medium text-ink">
                        {formatMoney(toNumber(o.totalAmount), cur)}
                      </span>
                      <span
                        className={`block text-xs ${
                          o.paymentStatus === "PAID"
                            ? "text-olive-600"
                            : "text-ink/45"
                        }`}
                      >
                        {o.paymentStatus === "PAID"
                          ? t(d, "history.paid")
                          : t(d, "history.unpaid")}
                      </span>
                    </span>
                    <StatusBadge status={o.status} />
                    <ChevronRight className="h-4 w-4 text-ink/30" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Pager
        basePath="/admin/orders/history"
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </div>
  );
}
