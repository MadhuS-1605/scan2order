import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { PLATFORM_AUDIT_LABELS } from "@/lib/audit";

export default async function PlatformAuditPage() {
  await requireSuperAdmin();
  const logs = await prisma.platformAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Resolve target restaurant names in one query.
  const ids = [...new Set(logs.map((l) => l.targetRestaurantId).filter(Boolean) as string[])];
  const names = new Map(
    (await prisma.restaurant.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }))
      .map((r) => [r.id, r.name]),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium text-ink">Platform audit log</h1>
          <p className="text-sm text-ink/45">Super-admin actions across all tenants (most recent first).</p>
        </div>
        <a href="/api/superadmin/export/audit" target="_blank" rel="noopener" className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100">Export CSV</a>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">When</th>
              <th className="px-4 py-2.5">Operator</th>
              <th className="px-4 py-2.5">Action</th>
              <th className="px-4 py-2.5">Tenant</th>
              <th className="px-4 py-2.5">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink/45">No platform actions recorded yet.</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink/55">
                    {l.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 text-ink/70">{l.actorName ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink">{PLATFORM_AUDIT_LABELS[l.action] ?? l.action}</td>
                  <td className="px-4 py-2.5">
                    {l.targetRestaurantId ? (
                      <Link href={`/superadmin/restaurants/${l.targetRestaurantId}`} className="text-brand-600 hover:underline">
                        {names.get(l.targetRestaurantId) ?? l.targetRestaurantId.slice(-6)}
                      </Link>
                    ) : (
                      <span className="text-ink/35">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink/55">{l.detail ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
