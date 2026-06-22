import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { requireSuperAdmin, resyncSubdomainAction } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { cloudflareConfigured, listDnsRecords } from "@/lib/cloudflare";

export default async function DomainsPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "platform.manage")) redirect("/superadmin");

  const configured = cloudflareConfigured();
  const [records, restaurants] = await Promise.all([
    listDnsRecords(),
    prisma.restaurant.findMany({
      where: { subdomain: { not: null } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subdomain: true, config: { select: { customDomain: true } } },
    }),
  ]);
  const present = new Set(records.map((r) => r.name.toLowerCase()));
  const fqdn = (sub: string) => `${sub}.${env.platformDomain}`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Domains & DNS</h1>
        <p className="text-sm text-ink/45">
          Per-tenant subdomains on <code className="text-ink/60">{env.platformDomain}</code> via Cloudflare.
        </p>
      </div>

      <div className={`rounded-xl border px-4 py-2.5 text-sm ${configured ? "border-olive-200 bg-olive-50 text-olive-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {configured
          ? `Cloudflare connected · ${records.length} CNAME record${records.length === 1 ? "" : "s"} in the zone.`
          : "Cloudflare is not configured — subdomain automation is disabled. Set CLOUDFLARE_API_TOKEN / ZONE_ID / DNS_TARGET."}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Restaurant</th>
              <th className="px-4 py-2.5">Subdomain</th>
              <th className="px-4 py-2.5">DNS</th>
              <th className="px-4 py-2.5">Custom domain</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {restaurants.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink/45">No tenants with a subdomain yet.</td></tr>
            ) : (
              restaurants.map((r) => {
                const host = fqdn(r.subdomain!);
                const ok = present.has(host.toLowerCase());
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/superadmin/restaurants/${r.id}`} className="font-medium text-ink hover:text-brand-600 hover:underline">{r.name}</Link>
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">{host}</td>
                    <td className="px-4 py-2.5">
                      {ok ? (
                        <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">Live</span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink/55">{r.config?.customDomain ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {configured && (
                        <form action={resyncSubdomainAction}>
                          <input type="hidden" name="restaurantId" value={r.id} />
                          <button type="submit" className="rounded-md border border-sand-300 px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-sand-100">
                            {ok ? "Re-sync" : "Create"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
