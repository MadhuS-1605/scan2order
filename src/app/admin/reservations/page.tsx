import { Users, Clock } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { getBaseUrl } from "@/lib/request";
import { Button, StatusBadge } from "@/components/ui";
import { LiveStream } from "@/components/live-stream";
import { setReservationStatusAction } from "@/lib/reservations/actions";

const NEXT_ACTIONS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirm" },
    { status: "CANCELLED", label: "Decline", danger: true },
  ],
  CONFIRMED: [
    { status: "SEATED", label: "Seat" },
    { status: "NO_SHOW", label: "No-show", danger: true },
  ],
  SEATED: [],
};

export default async function ReservationsPage() {
  const { restaurant } = await getCurrentRestaurant("orders");
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [reservations, waitlist] = await Promise.all([
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        type: "RESERVATION",
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        reservedFor: { gte: startOfToday },
      },
      orderBy: { reservedFor: "asc" },
    }),
    prisma.reservation.findMany({
      where: {
        restaurantId: restaurant.id,
        type: "WAITLIST",
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const bookUrl = `${await getBaseUrl()}/book/${restaurant.slug}`;

  return (
    <div className="space-y-5">
      <LiveStream />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-3xl font-medium text-ink">
          Reservations
        </h1>
        <a
          href={bookUrl}
          target="_blank"
          className="rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-xs text-ink/60 hover:border-brand-300"
        >
          Booking link: <span className="text-brand-600">{bookUrl}</span>
        </a>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg text-ink">
          <Clock className="h-4 w-4 text-ink/40" />
          Waitlist ({waitlist.length})
        </h2>
        {waitlist.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-300 bg-surface p-6 text-center text-sm text-ink/45">
            Nobody waiting.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {waitlist.map((r) => (
              <ResCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg text-ink">
          <Users className="h-4 w-4 text-ink/40" />
          Upcoming reservations ({reservations.length})
        </h2>
        {reservations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-sand-300 bg-surface p-6 text-center text-sm text-ink/45">
            No upcoming reservations.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reservations.map((r) => (
              <ResCard key={r.id} r={r} showTime />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ResCard({
  r,
  showTime,
}: {
  r: {
    id: string;
    customerName: string;
    customerPhone: string;
    partySize: number;
    reservedFor: Date | null;
    notes: string | null;
    status: string;
  };
  showTime?: boolean;
}) {
  const actions = NEXT_ACTIONS[r.status] ?? [];
  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-ink">
            {r.customerName}{" "}
            <span className="text-sm font-normal text-ink/45">
              · {r.partySize} {r.partySize === 1 ? "guest" : "guests"}
            </span>
          </p>
          <p className="text-xs text-ink/50">{r.customerPhone}</p>
        </div>
        <StatusBadge status={r.status} />
      </div>
      {showTime && r.reservedFor && (
        <p className="mt-2 text-sm font-medium text-brand-700">
          {r.reservedFor.toLocaleString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
      {r.notes && <p className="mt-1 text-xs text-ink/55">{r.notes}</p>}
      {actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((a) => (
            <form key={a.status} action={setReservationStatusAction}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="status" value={a.status} />
              <Button
                size="sm"
                variant={a.danger ? "danger" : "primary"}
                type="submit"
              >
                {a.label}
              </Button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
