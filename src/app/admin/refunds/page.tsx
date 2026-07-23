import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card } from "@/components/ui";
import { ApproveRejectForm } from "./approve-reject-form";

export default async function RefundsPage() {
  const { restaurant, config } = await getCurrentRestaurant("refunds");
  const cur = config.currency;

  const pending = await prisma.refund.findMany({
    where: { restaurantId: restaurant.id, status: "PENDING" },
    include: { order: { select: { orderNumber: true, id: true } } },
    orderBy: { createdAt: "asc" },
  });
  const recent = await prisma.refund.findMany({
    where: { restaurantId: restaurant.id, status: { in: ["DONE", "REJECTED", "FAILED"] } },
    include: { order: { select: { orderNumber: true, id: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">Refunds</h1>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">
          Pending approval {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-ink/45">Nothing waiting on approval.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-sand-100">
              {pending.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-ink">
                      #{r.order.orderNumber} · {formatMoney(toNumber(r.amount), cur)} · {r.method}
                    </p>
                    <p className="text-xs text-ink/45">
                      {r.reason ? `${r.reason} · ` : ""}
                      requested by {r.createdByName ?? "staff"} · {r.createdAt.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <ApproveRejectForm refundId={r.id} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Recent</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-ink/45">No refunds yet.</p>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-sand-100">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <span className="text-ink/70">
                    #{r.order.orderNumber} · {formatMoney(toNumber(r.amount), cur)} · {r.method}
                    {r.reason ? ` · ${r.reason}` : ""}
                    {r.createdByName ? ` · requested by ${r.createdByName}` : ""}
                    {r.approvedByName ? ` · ${r.status === "REJECTED" ? "declined" : "approved"} by ${r.approvedByName}` : ""}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "DONE"
                        ? "bg-olive-500/15 text-olive-700"
                        : r.status === "REJECTED"
                          ? "bg-sand-200 text-ink/60"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
