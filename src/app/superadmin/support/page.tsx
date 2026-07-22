import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { StatCard } from "@/components/superadmin/stat-card";
import { AlertCircle } from "lucide-react";
import { SupportManager } from "./support-manager";

export default async function SupportPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "tenants.manage")) redirect("/superadmin");

  const [tickets, restaurants] = await Promise.all([
    prisma.supportTicket.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.restaurant.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const nameById = new Map(restaurants.map((r) => [r.id, r.name]));
  const openCount = tickets.filter((t) => t.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Support</h1>
        <p className="text-sm text-ink/45">Manual log of tenant issues — not a full ticketing system, just a shared record.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={String(openCount)} sub="unresolved issues" icon={AlertCircle} alert={openCount > 0} />
        <StatCard label="Total logged" value={String(tickets.length)} sub="all-time" icon={AlertCircle} />
      </div>

      <SupportManager
        tickets={tickets.map((t) => ({
          id: t.id,
          restaurantId: t.restaurantId,
          restaurantName: t.restaurantId ? nameById.get(t.restaurantId) ?? "—" : null,
          subject: t.subject,
          description: t.description,
          status: t.status,
          createdAt: t.createdAt.toISOString(),
          resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
        }))}
        restaurants={restaurants}
      />
    </div>
  );
}
