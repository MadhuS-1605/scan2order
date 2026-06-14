import Link from "next/link";
import {
  ShoppingBag,
  BellRing,
  PackageX,
  CalendarClock,
  PartyPopper,
} from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { getNotificationFeed, type Notif } from "@/lib/notifications/feed";
import { LiveStream } from "@/components/live-stream";
import { Card } from "@/components/ui";
import { MarkNotificationsSeen } from "./mark-seen";

const ICON: Record<Notif["kind"], typeof ShoppingBag> = {
  order: ShoppingBag,
  service: BellRing,
  stock: PackageX,
  reservation: CalendarClock,
  banquet: PartyPopper,
};
const TINT: Record<Notif["kind"], string> = {
  order: "bg-blue-100 text-blue-600",
  service: "bg-brand-100 text-brand-600",
  stock: "bg-red-100 text-red-600",
  reservation: "bg-olive-500/15 text-olive-700",
  banquet: "bg-amber-100 text-amber-700",
};

function ago(d: Date): string {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default async function NotificationsPage() {
  const { restaurant } = await getCurrentRestaurant("overview");
  const feed = await getNotificationFeed(restaurant.id);

  return (
    <div className="space-y-5">
      <LiveStream />
      <MarkNotificationsSeen />
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Notifications</h1>
        <p className="text-sm text-ink/45">
          New orders, service calls, low stock, reservations &amp; event enquiries.
        </p>
      </div>

      {feed.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-ink/45">
            All caught up — no alerts right now. 🎉
          </p>
        </Card>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-sand-100">
            {feed.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <Link
                    href={n.href}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-sand-100/60"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TINT[n.kind]}`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {n.title}
                      </span>
                      <span className="block truncate text-xs text-ink/50">
                        {n.detail}
                      </span>
                    </span>
                    <time className="shrink-0 text-xs text-ink/40">{ago(n.at)}</time>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
