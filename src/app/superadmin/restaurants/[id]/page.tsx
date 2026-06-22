import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import {
  requireSuperAdmin,
  superGrantPlanAction,
  superSuspendAction,
  superReactivateAction,
  startImpersonationAction,
  addTenantNoteAction,
  deleteTenantNoteAction,
  deleteTenantAction,
} from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { PLANS, planByTier, allowanceForTier } from "@/lib/plans";
import { subscriptionState } from "@/lib/subscription";
import { currentUsage } from "@/lib/usage";
import { getOutstandingOverage } from "@/lib/billing/overage";
import { formatMoney, toNumber } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/auth/permissions";

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await requireSuperAdmin();
  const canTenants = platformCan(s.platformRole, "tenants.manage");
  const canBilling = platformCan(s.platformRole, "billing.manage");
  const canPlatform = platformCan(s.platformRole, "platform.manage");
  const { id } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      config: { select: { currency: true } },
      _count: { select: { orders: true } },
    },
  });
  if (!restaurant) notFound();

  const [admins, paidAgg, usage, outstanding, recentPayments, notes] = await Promise.all([
    prisma.adminUser.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, username: true, role: true, disabled: true },
    }),
    prisma.order.aggregate({ where: { restaurantId: id, paymentStatus: "PAID" }, _sum: { totalAmount: true } }),
    currentUsage(id),
    getOutstandingOverage(id),
    prisma.planPayment.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, tier: true, amount: true, status: true, createdAt: true },
    }),
    prisma.tenantNote.findMany({
      where: { restaurantId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const sub = subscriptionState(restaurant);
  const allowance = allowanceForTier(sub.effectiveTier);
  const cur = restaurant.config?.currency ?? "INR";
  const suspended = restaurant.status === "SUSPENDED";

  const card = "rounded-2xl border border-sand-200 bg-surface p-5";
  const fmtDate = (dt: Date) =>
    dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="space-y-5">
      <Link href="/superadmin" className="inline-flex items-center gap-1.5 text-sm text-ink/55 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Console
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-medium text-ink">{restaurant.name}</h1>
            {suspended ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Suspended</span>
            ) : (
              <span className="rounded-full bg-olive-100 px-2 py-0.5 text-xs font-medium text-olive-700">Active</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-ink/45">
            /{restaurant.slug}
            {restaurant.subdomain ? ` · ${restaurant.subdomain}` : ""} · {restaurant.type} ·
            {restaurant.city ? ` ${restaurant.city}` : ""} · joined {fmtDate(restaurant.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/superadmin/analytics?restaurant=${id}`}
            className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
          >
            Analytics
          </Link>
          {canTenants && (
            <form action={startImpersonationAction}>
              <input type="hidden" name="restaurantId" value={id} />
              <button
                type="submit"
                className="rounded-lg border border-brand-300 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100"
              >
                Log in as tenant
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Subscription + grant */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Subscription</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Plan" value={`${planByTier(sub.tier).name} (${sub.status})`} />
            <Row label="Effective tier" value={sub.effectiveTier} />
            <Row label="Days left" value={sub.daysLeft != null ? String(sub.daysLeft) : "—"} />
            <Row
              label="Active until"
              value={restaurant.planActiveUntil ? fmtDate(restaurant.planActiveUntil) : "—"}
            />
            <Row label="Auto-renew" value={restaurant.planAutoRenew ? "On" : "Off"} />
          </dl>
          {canBilling && (
          <form action={superGrantPlanAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-sand-100 pt-4">
            <input type="hidden" name="restaurantId" value={id} />
            <label className="text-xs text-ink/55">
              Tier
              <select name="tier" defaultValue={sub.tier} className="mt-1 block rounded-md border border-sand-300 bg-surface px-2 py-1 text-sm">
                {PLANS.map((p) => (
                  <option key={p.tier} value={p.tier}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink/55">
              Days
              <input name="days" type="number" min="1" max="3650" defaultValue={30} className="mt-1 block w-20 rounded-md border border-sand-300 bg-surface px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink/60">
              <input type="checkbox" name="trial" /> Trial
            </label>
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              Grant / extend
            </button>
          </form>
          )}
        </div>

        {/* Lifecycle */}
        {canTenants && (
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Lifecycle</h2>
          {suspended ? (
            <div className="space-y-3">
              <p className="text-sm text-ink/60">
                Suspended{restaurant.suspendedAt ? ` on ${fmtDate(restaurant.suspendedAt)}` : ""}.
                {restaurant.suspendedReason ? ` Reason: ${restaurant.suspendedReason}` : ""}
              </p>
              <form action={superReactivateAction}>
                <input type="hidden" name="restaurantId" value={id} />
                <button type="submit" className="rounded-md bg-olive-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-olive-700">
                  Reactivate
                </button>
              </form>
            </div>
          ) : (
            <form action={superSuspendAction} className="space-y-2">
              <input type="hidden" name="restaurantId" value={id} />
              <p className="text-sm text-ink/55">Suspending blocks the tenant&apos;s admin until reactivated.</p>
              <input
                name="reason"
                placeholder="Reason (shown to the owner, optional)"
                className="w-full rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm"
              />
              <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                Suspend
              </button>
            </form>
          )}
        </div>
        )}

        {/* Usage & overage */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Usage this month</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="WhatsApp" value={`${usage.whatsapp.toLocaleString("en-IN")}${allowance.whatsapp == null ? " · unlimited" : ` / ${allowance.whatsapp.toLocaleString("en-IN")}`}`} />
            <Row label="Emails" value={`${usage.email.toLocaleString("en-IN")}${allowance.email == null ? " · unlimited" : ` / ${allowance.email.toLocaleString("en-IN")}`}`} />
            <Row label="Outstanding overage" value={outstanding.total > 0 ? formatMoney(outstanding.total) : "—"} />
          </dl>
        </div>

        {/* Tenant sales */}
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Tenant sales</h2>
          <dl className="space-y-1.5 text-sm">
            <Row label="Orders (all-time)" value={restaurant._count.orders.toLocaleString("en-IN")} />
            <Row label="Paid revenue" value={formatMoney(toNumber(paidAgg._sum.totalAmount ?? 0), cur)} />
          </dl>
        </div>
      </div>

      {/* Users */}
      <div className={card}>
        <h2 className="mb-3 font-medium text-ink">Team ({admins.length})</h2>
        <ul className="divide-y divide-sand-100">
          {admins.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium text-ink">{a.name}</span>
                <span className="ml-2 text-ink/45">{a.email ?? a.username ?? ""}</span>
              </span>
              <span className="flex items-center gap-2">
                {a.disabled && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">Disabled</span>}
                <span className="rounded bg-sand-100 px-1.5 py-0.5 text-xs text-ink/55">{ROLE_LABELS[a.role] ?? a.role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recent plan payments */}
      <div className={card}>
        <h2 className="mb-3 font-medium text-ink">Recent plan payments</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-ink/45">No plan payments yet.</p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {recentPayments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink/70">{p.tier} · {fmtDate(p.createdAt)}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-ink">{formatMoney(toNumber(p.amount))}</span>
                  <span className={`rounded px-1.5 py-0.5 text-xs ${p.status === "PAID" ? "bg-olive-100 text-olive-700" : "bg-sand-100 text-ink/55"}`}>
                    {p.status}
                  </span>
                  {p.status === "PAID" && (
                    <a href={`/api/billing/invoice/${p.id}?kind=plan`} target="_blank" rel="noopener" className="text-xs text-brand-600 hover:underline">Invoice</a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Internal support notes */}
      {canTenants && (
        <div className={card}>
          <h2 className="mb-3 font-medium text-ink">Internal notes</h2>
          <form action={addTenantNoteAction} className="flex gap-2">
            <input type="hidden" name="restaurantId" value={id} />
            <input name="body" required maxLength={1000} placeholder="Add a note (internal only)…" className="flex-1 rounded-md border border-sand-300 bg-surface px-3 py-2 text-sm" />
            <button type="submit" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Add</button>
          </form>
          {notes.length > 0 && (
            <ul className="mt-3 divide-y divide-sand-100">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="text-ink/80">{n.body}</span>
                    <span className="mt-0.5 block text-xs text-ink/40">
                      {n.authorName ?? "—"} · {fmtDate(n.createdAt)}
                    </span>
                  </span>
                  <form action={deleteTenantNoteAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <input type="hidden" name="restaurantId" value={id} />
                    <button type="submit" className="shrink-0 text-xs text-ink/40 hover:text-red-600">Delete</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Danger zone — export + delete (FULL operators only) */}
      {canPlatform && (
        <div className="rounded-2xl border border-red-200 bg-red-50/40 p-5">
          <h2 className="mb-1 font-medium text-red-800">Danger zone</h2>
          <p className="mb-3 text-sm text-ink/55">Export this venue&apos;s data, or permanently delete it (removes its DNS record and all data).</p>
          <div className="flex flex-wrap items-end gap-3">
            <a
              href={`/api/superadmin/tenant/${id}/export`}
              target="_blank"
              rel="noopener"
              className="rounded-md border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
            >
              Export data (JSON)
            </a>
            <form action={deleteTenantAction} className="flex items-end gap-2">
              <input type="hidden" name="restaurantId" value={id} />
              <label className="text-xs text-red-700">
                Type <code className="font-mono">{restaurant.slug}</code> to delete
                <input name="confirm" autoComplete="off" className="mt-1 block rounded-md border border-red-300 bg-surface px-2 py-1.5 text-sm" />
              </label>
              <button type="submit" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">Delete venue</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink/50">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
