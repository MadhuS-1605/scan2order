import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, setPlatformRoleAction } from "@/lib/platform/actions";
import { platformCan, PLATFORM_ROLE_LABELS, type PlatformRole } from "@/lib/platform/roles";

const ROLES: PlatformRole[] = ["FULL", "BILLING", "SUPPORT"];

export default async function OperatorsPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "platform.manage")) redirect("/superadmin");

  const operators = await prisma.adminUser.findMany({
    where: { isSuperAdmin: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, platformRole: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Operators</h1>
        <p className="text-sm text-ink/45">
          Platform sub-roles. <strong>Full</strong> = everything · <strong>Billing</strong> = revenue & plan grants ·
          <strong> Support</strong> = tenant management & impersonation (no billing).
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-sand-200 bg-surface">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Operator</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {operators.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5">
                  <span className="font-medium text-ink">{o.name}</span>
                  <span className="block text-xs text-ink/40">{o.email ?? "—"}</span>
                </td>
                <td className="px-4 py-2.5">
                  <form action={setPlatformRoleAction} className="flex items-center gap-1">
                    <input type="hidden" name="userId" value={o.id} />
                    <select name="role" defaultValue={o.platformRole} className="rounded-md border border-sand-300 bg-surface px-2 py-1 text-xs" disabled={o.id === s.sub}>
                      {ROLES.map((r) => <option key={r} value={r}>{PLATFORM_ROLE_LABELS[r]}</option>)}
                    </select>
                    <button type="submit" disabled={o.id === s.sub} className="rounded-md bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40">
                      Set
                    </button>
                    {o.id === s.sub && <span className="text-xs text-ink/40">you</span>}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
