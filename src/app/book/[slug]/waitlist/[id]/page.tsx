import { notFound } from "next/navigation";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { prisma } from "@/lib/db";
import { LiveRefresh } from "@/components/live-refresh";

// A guest's own live position in the walk-in waitlist — reached via the
// "See your live position" link shown right after joining
// (src/app/book/[slug]/booking-form.tsx). The unguessable reservation id is
// the capability here, same trust model as the qrToken-gated diner pages.
export default async function WaitlistStatusPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { restaurant: true },
  });
  if (
    !reservation ||
    reservation.restaurant.slug !== slug ||
    reservation.type !== "WAITLIST"
  ) {
    notFound();
  }

  const waiting = reservation.status === "PENDING" || reservation.status === "CONFIRMED";
  const position = waiting
    ? await prisma.reservation.count({
        where: {
          restaurantId: reservation.restaurantId,
          type: "WAITLIST",
          status: { in: ["PENDING", "CONFIRMED"] },
          createdAt: { lte: reservation.createdAt },
        },
      })
    : null;

  return (
    <div className="min-h-screen bg-grain">
      {waiting && <LiveRefresh intervalMs={15000} />}
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-center text-xs uppercase tracking-wide text-ink/45">
          {reservation.restaurant.name}
        </p>
        <h1 className="mt-1 text-center font-display text-3xl text-ink">Waitlist</h1>

        <div className="mt-6 rounded-2xl border border-sand-200 bg-surface p-6 text-center">
          {reservation.status === "SEATED" ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-olive-600" />
              <p className="mt-3 font-display text-xl text-ink">You&apos;re seated!</p>
              <p className="mt-1 text-sm text-ink/55">
                Enjoy your meal, {reservation.customerName}.
              </p>
            </>
          ) : reservation.status === "CANCELLED" || reservation.status === "NO_SHOW" ? (
            <>
              <XCircle className="mx-auto h-10 w-10 text-ink/30" />
              <p className="mt-3 font-display text-xl text-ink">No longer on the waitlist</p>
              <p className="mt-1 text-sm text-ink/55">
                This entry isn&apos;t active anymore — contact the restaurant if that&apos;s unexpected.
              </p>
            </>
          ) : (
            <>
              <Clock className="mx-auto h-10 w-10 text-brand-600" />
              <p className="mt-1 text-sm text-ink/55">
                {reservation.customerName} · party of {reservation.partySize}
              </p>
              <p className="mt-2 font-display text-5xl text-ink">#{position}</p>
              <p className="mt-1 text-sm text-ink/55">in line</p>
              <p className="mt-4 text-xs text-ink/45">
                We&apos;ll text you on WhatsApp when your table&apos;s ready. This page updates
                automatically.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
