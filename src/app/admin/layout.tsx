import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { subscriptionState } from "@/lib/subscription";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { signoutAction } from "@/lib/auth/actions";
import { stopImpersonationAction } from "@/lib/platform/actions";
import { ROLE_LABELS, hasPermission } from "@/lib/auth/permissions";
import { getNotificationCount } from "@/lib/notifications/feed";
import { ClockWidget } from "@/components/admin/clock-widget";
import { MobileNav } from "@/components/admin/mobile-nav";
import { Toaster } from "@/components/admin/toast";
import { AdminI18nProvider } from "@/components/admin/i18n-provider";
import { LocaleSwitcher } from "@/components/admin/locale-switcher";
import { ADMIN_LOCALE_COOKIE, dictFor } from "@/lib/i18n";
import { AdminNav } from "./nav";
import { PropertySwitcher } from "./property-switcher";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A platform-only super-admin (no restaurant of their own) has no admin
  // dashboard to show, so send them to the console. A super-admin who also owns
  // a restaurant (e.g. the demo owner) is NOT redirected — they use /admin and
  // reach the console via the "Console" link in the header.
  const s = await getSession();
  if (s && !s.restaurantId) {
    const u = await prisma.adminUser.findUnique({
      where: { id: s.sub },
      select: { isSuperAdmin: true },
    });
    if (u?.isSuperAdmin) redirect("/superadmin");
  }

  const { restaurant, config, session } = await getCurrentRestaurant();

  // A platform-suspended venue can't use its admin. An impersonating super-admin
  // bypasses this so they can still inspect/support the account.
  if (restaurant.status === "SUSPENDED" && !session.impersonatorId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grain px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="font-display text-2xl text-red-800">Account suspended</h1>
          <p className="mt-2 text-sm text-red-700">
            {restaurant.suspendedReason ||
              "This account has been suspended. Please contact support to restore access."}
          </p>
          <form action={signoutAction} className="mt-5">
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  const sub = subscriptionState(restaurant);
  const announcement = await prisma.announcement.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { title: true, body: true, level: true },
  });
  const cookieStore = await cookies();
  const locale = cookieStore.get(ADMIN_LOCALE_COOKIE)?.value ?? "en";
  const dict = dictFor(locale);
  const seen = Number(cookieStore.get("sto_notif_seen")?.value ?? 0) || undefined;
  const notifCount = await getNotificationCount(restaurant.id, seen);
  const features = {
    featureReservations: config.featureReservations,
    featureRooms: config.featureRooms,
    featureBanquets: config.featureBanquets,
    featureBar: config.featureBar,
    featureAttendance: config.featureAttendance,
  };

  // Current open attendance punch for the clock-in/out header widget.
  const openPunch = config.featureAttendance
    ? await prisma.staffAttendance.findFirst({
        where: { adminUserId: session.sub, clockOutAt: null },
        orderBy: { clockInAt: "desc" },
        select: { clockInAt: true },
      })
    : null;

  const me = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { groupId: true, isSuperAdmin: true },
  });
  let properties: { id: string; name: string }[] = [];
  if (hasPermission(session.role, "properties") && me?.groupId) {
    properties = await prisma.restaurant.findMany({
      where: { groupId: me.groupId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  }

  return (
    <AdminI18nProvider dict={dict}>
    <div className="min-h-screen bg-grain">
      {session.impersonatorId && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-amber-950">
          <span>
            Viewing as <strong>{restaurant.name}</strong> — impersonating (
            {session.impersonatorName})
          </span>
          <form action={stopImpersonationAction}>
            <button type="submit" className="underline underline-offset-2 hover:opacity-80">
              Exit impersonation
            </button>
          </form>
        </div>
      )}
      <header className="sticky top-0 z-20 border-b border-sand-200 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MobileNav role={session.role} features={features} />
            <div className="min-w-0">
              <p className="truncate font-display text-lg leading-tight text-ink">
                {restaurant.name}
              </p>
              <p className="text-xs uppercase tracking-wide text-ink/40">
                Admin dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LocaleSwitcher current={locale} />
            {config.featureAttendance && (
              <ClockWidget
                openSince={openPunch ? openPunch.clockInAt.toISOString() : null}
              />
            )}
            <Link
              href="/admin/notifications"
              aria-label="Notifications"
              className="relative rounded-lg border border-sand-300 p-2 text-ink/65 transition-colors hover:border-brand-300 hover:bg-sand-100"
            >
              <Bell className="h-4 w-4" />
              {notifCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </Link>
            {properties.length > 1 && (
              <PropertySwitcher properties={properties} currentId={restaurant.id} />
            )}
            {me?.isSuperAdmin && (
              <Link
                href="/superadmin"
                className="hidden rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:border-brand-300 hover:bg-sand-100 sm:block"
              >
                Console
              </Link>
            )}
            <span className="hidden text-sm text-ink/55 sm:block">
              {session.name}
              <span className="ml-1.5 rounded bg-sand-100 px-1.5 py-0.5 text-xs text-ink/45">
                {ROLE_LABELS[session.role] ?? session.role}
              </span>
            </span>
            <form action={signoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-sand-300 p-2 text-sm text-ink/70 transition-colors hover:border-brand-300 hover:bg-sand-100 sm:px-3 sm:py-1.5"
              >
                <LogOut className="h-4 w-4 sm:hidden" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      {announcement && (
        <div
          className={`border-b px-4 py-2 text-center text-sm sm:px-6 ${
            announcement.level === "WARNING"
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-brand-200 bg-brand-50 text-brand-700"
          }`}
        >
          <span className="font-medium">{announcement.title}</span>
          {announcement.body && <span className="ml-2 text-ink/60">{announcement.body}</span>}
        </div>
      )}

      {(sub.status === "EXPIRED" || (sub.status === "TRIAL" && (sub.daysLeft ?? 0) <= 3)) && (
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
          <Link
            href="/admin/billing"
            className={`block rounded-xl border px-4 py-2.5 text-sm font-medium ${
              sub.status === "EXPIRED"
                ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
            }`}
          >
            {sub.status === "EXPIRED"
              ? "Your subscription has expired — you're on Free-tier limits. Renew →"
              : `Your free trial ends in ${sub.daysLeft} day${sub.daysLeft === 1 ? "" : "s"} — subscribe to keep your features →`}
          </Link>
        </div>
      )}

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:gap-6 sm:px-6 md:flex-row">
        <aside className="hidden md:block md:w-52 md:shrink-0">
          <AdminNav role={session.role} features={features} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="mx-auto flex max-w-7xl items-center justify-center gap-1.5 px-4 pb-8 pt-2 text-xs text-ink/35 sm:px-6">
        Powered by
        <Image src="/logo-mark.png" alt="Scan2Order" width={16} height={16} className="h-4 w-4" />
      </footer>
      <Toaster />
    </div>
    </AdminI18nProvider>
  );
}
