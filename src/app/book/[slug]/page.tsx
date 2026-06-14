import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BookingForm } from "./booking-form";

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const restaurant = await prisma.restaurant.findUnique({ where: { slug } });
  if (!restaurant) notFound();

  return (
    <div className="min-h-screen bg-grain">
      <div className="mx-auto max-w-lg px-4 py-8">
        <p className="text-center text-xs uppercase tracking-wide text-ink/45">
          Reserve a table
        </p>
        <h1 className="mt-1 text-center font-display text-3xl text-ink">
          {restaurant.name}
        </h1>
        <div className="mt-6">
          <BookingForm slug={slug} restaurantName={restaurant.name} />
        </div>
      </div>
    </div>
  );
}
