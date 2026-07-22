import Link from "next/link";
import Image from "next/image";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { signoutAction } from "@/lib/auth/actions";
import { platformCan, type PlatformCapability } from "@/lib/platform/roles";
import { SuperAdminNav } from "./nav";

const NAV: { href: string; label: string; cap?: PlatformCapability }[] = [
  { href: "/superadmin", label: "Console" },
  { href: "/superadmin/billing", label: "Revenue", cap: "billing.manage" },
  { href: "/superadmin/vendor-bills", label: "Vendor bills", cap: "billing.manage" },
  { href: "/superadmin/plans", label: "Plans", cap: "billing.manage" },
  { href: "/superadmin/promos", label: "Promos", cap: "billing.manage" },
  { href: "/superadmin/growth", label: "Growth" },
  { href: "/superadmin/health", label: "Health" },
  { href: "/superadmin/retention", label: "Retention" },
  { href: "/superadmin/support", label: "Support", cap: "tenants.manage" },
  { href: "/superadmin/onboard", label: "Invite", cap: "platform.manage" },
  { href: "/superadmin/analytics", label: "Analytics" },
  { href: "/superadmin/announcements", label: "Announce", cap: "platform.manage" },
  { href: "/superadmin/operators", label: "Operators", cap: "platform.manage" },
  { href: "/superadmin/flags", label: "Flags", cap: "platform.manage" },
  { href: "/superadmin/domains", label: "Domains", cap: "platform.manage" },
  { href: "/superadmin/audit", label: "Audit" },
  { href: "/superadmin/security", label: "Security" },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSuperAdmin();
  const navItems = NAV.filter(
    (n) => !n.cap || platformCan(session.platformRole, n.cap),
  ).map(({ href, label }) => ({ href, label }));
  return (
    <div className="min-h-screen bg-grain">
      <header className="sticky top-0 z-30 border-b border-sand-200 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-mark.png"
              alt="Scan2Order · Platform"
              width={40}
              height={40}
              className="hidden h-10 w-10 shrink-0 sm:block"
            />
            <SuperAdminNav items={navItems} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 sm:inline">
              Super admin
            </span>
            {session.restaurantId && (
              <Link
                href="/admin"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
              >
                Restaurant dashboard
              </Link>
            )}
            <form action={signoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-6">{children}</div>
    </div>
  );
}
