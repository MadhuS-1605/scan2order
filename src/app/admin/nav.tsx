"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bell,
  ShoppingBag,
  ChefHat,
  Wine,
  MonitorPlay,
  LayoutGrid,
  UtensilsCrossed,
  Ticket,
  Boxes,
  QrCode,
  CalendarClock,
  BedDouble,
  PartyPopper,
  BarChart3,
  Star,
  Download,
  Receipt,
  Contact,
  Users,
  Clock,
  Building2,
  ScrollText,
  Plug,
  CreditCard,
  Settings,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { useT } from "@/components/admin/i18n-provider";

export type FeatureFlags = {
  featureReservations: boolean;
  featureRooms: boolean;
  featureBanquets: boolean;
  featureBar: boolean;
  featureAttendance: boolean;
};

type NavLink = {
  href: string;
  label: string;
  perm: Permission;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  feature?: keyof FeatureFlags;
};

const GROUPS: { heading: string; links: NavLink[] }[] = [
  {
    heading: "Main",
    links: [
      { href: "/admin", label: "Overview", perm: "overview", icon: LayoutDashboard, exact: true },
      { href: "/admin/notifications", label: "Notifications", perm: "overview", icon: Bell },
      { href: "/admin/orders", label: "Orders", perm: "orders", icon: ShoppingBag },
      { href: "/admin/refunds", label: "Refunds", perm: "refunds", icon: Undo2 },
      { href: "/admin/floor", label: "Floor", perm: "orders", icon: LayoutGrid },
      { href: "/admin/kitchen", label: "Kitchen", perm: "kitchen", icon: ChefHat },
      { href: "/admin/bar", label: "Bar", perm: "kitchen", icon: Wine, feature: "featureBar" },
      { href: "/admin/monitor", label: "Monitor", perm: "monitor", icon: MonitorPlay },
    ],
  },
  {
    heading: "Manage",
    links: [
      { href: "/admin/menu", label: "Menu", perm: "menu", icon: UtensilsCrossed },
      { href: "/admin/coupons", label: "Coupons", perm: "menu", icon: Ticket },
      { href: "/admin/inventory", label: "Inventory", perm: "menu", icon: Boxes },
      { href: "/admin/tables", label: "Tables & QR", perm: "tables", icon: QrCode },
      { href: "/admin/reservations", label: "Reservations", perm: "orders", icon: CalendarClock, feature: "featureReservations" },
      { href: "/admin/rooms", label: "Rooms", perm: "orders", icon: BedDouble, feature: "featureRooms" },
      { href: "/admin/banquets", label: "Banquets", perm: "orders", icon: PartyPopper, feature: "featureBanquets" },
    ],
  },
  {
    heading: "Insights",
    links: [
      { href: "/admin/analytics", label: "Analytics", perm: "analytics", icon: BarChart3 },
      { href: "/admin/reports", label: "Reports", perm: "analytics", icon: Receipt },
      { href: "/admin/customers", label: "Guests", perm: "analytics", icon: Contact },
      { href: "/admin/feedback", label: "Feedback", perm: "analytics", icon: Star },
      { href: "/admin/export", label: "Export", perm: "analytics", icon: Download },
    ],
  },
  {
    heading: "Business",
    links: [
      { href: "/admin/staff", label: "Staff", perm: "staff", icon: Users },
      { href: "/admin/attendance", label: "Attendance", perm: "attendance", icon: Clock, feature: "featureAttendance" },
      { href: "/admin/properties", label: "Properties", perm: "properties", icon: Building2 },
      { href: "/admin/audit", label: "Audit log", perm: "settings", icon: ScrollText },
      { href: "/admin/integrations", label: "Integrations", perm: "settings", icon: Plug },
      { href: "/admin/billing", label: "Plan & billing", perm: "settings", icon: CreditCard },
      { href: "/admin/settings", label: "Settings", perm: "settings", icon: Settings },
    ],
  },
];

// Shared grouped nav links — used by the desktop sidebar (AdminNav) and the
// mobile drawer (MobileNav). `onNavigate` lets the drawer close on tap.
export function NavLinks({
  role,
  features,
  onNavigate,
}: {
  role: string;
  features: FeatureFlags;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useT();
  const allow = (l: NavLink) =>
    hasPermission(role, l.perm) && (!l.feature || features[l.feature]);

  return (
    <>
      {GROUPS.map((g) => {
        const links = g.links.filter(allow);
        if (links.length === 0) return null;
        return (
          <Fragment key={g.heading}>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-ink/35">
              {t(`nav.${g.heading}`)}
            </p>
            {links.map((l) => {
              const active = l.exact
                ? pathname === l.href
                : pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-600 text-white"
                      : "text-ink/65 hover:bg-sand-100 hover:text-ink",
                  )}
                >
                  <l.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                  {t(`nav.${l.label}`)}
                </Link>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
}

// Desktop vertical sidebar (hidden on mobile — see the layout; mobile uses the
// hamburger drawer instead).
export function AdminNav({
  role,
  features,
}: {
  role: string;
  features: FeatureFlags;
}) {
  return (
    <nav className="flex flex-col gap-0.5 px-3">
      <NavLinks role={role} features={features} />
    </nav>
  );
}
