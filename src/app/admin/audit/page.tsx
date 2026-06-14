import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { AUDIT_LABELS } from "@/lib/audit";
import { Card } from "@/components/ui";
import { Pager } from "@/components/admin/pager";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { restaurant } = await getCurrentRestaurant("settings");
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const where = { restaurantId: restaurant.id };
  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Audit log</h1>
        <p className="text-sm text-ink/45">
          Who changed what — staff, settings, payments, coupons.
        </p>
      </div>

      <Card className="p-0">
        {logs.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink/45">
            No activity recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    {AUDIT_LABELS[l.action] ?? l.action}
                    {l.detail && (
                      <span className="text-ink/50"> — {l.detail}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink/45">
                    {l.actorName ?? "System"}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-ink/40">
                  {l.createdAt.toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Pager basePath="/admin/audit" page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}
