import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CustomerHeader } from "@/components/customer-header";

// Self-service kiosk attract screen: pin a tablet's browser to
// /kiosk/<restaurant-slug> in kiosk mode. Tapping "Start" goes through the
// same /t/<qrToken> flow a QR scan would (proxy.ts sets the table cookie and
// redirects into /menu) — no separate ordering path to maintain.
//
// ponytail: doesn't auto-reset to this screen after checkout/idle — a kiosk
// browser's own kiosk-mode timeout/reload handles that for now; add a
// client-side idle timer on the order-confirmation page if that's not enough.
export default async function KioskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: { config: true },
  });
  if (!restaurant || !restaurant.config || restaurant.config.serviceModel !== "SELF_SERVICE") {
    notFound();
  }

  const counter = await prisma.restaurantTable.findFirst({
    where: { restaurantId: restaurant.id, kind: "COUNTER", isActive: true },
  });
  if (!counter) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-grain">
      <CustomerHeader restaurantName={restaurant.name} logoUrl={restaurant.logoUrl} />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-4xl font-medium text-ink">{restaurant.name}</h1>
        <p className="mt-2 text-lg text-ink/55">Welcome! Tap below to start your order.</p>
        <Link
          href={`/t/${counter.qrToken}`}
          className="mt-10 rounded-2xl bg-brand-600 px-12 py-6 font-display text-3xl text-white shadow-lg shadow-brand-600/30 transition-all hover:bg-brand-700 active:translate-y-px"
        >
          Start order
        </Link>
      </div>
    </div>
  );
}
