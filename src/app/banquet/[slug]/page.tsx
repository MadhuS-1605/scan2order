import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BanquetEnquiryForm } from "./enquiry-form";

export default async function BanquetPage({
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
          Banquet &amp; event enquiry
        </p>
        <h1 className="mt-1 text-center font-display text-3xl text-ink">
          {restaurant.name}
        </h1>
        <p className="mt-2 text-center text-sm text-ink/55">
          Tell us about your event and we&apos;ll get back with a menu and quote.
        </p>
        <div className="mt-6">
          <BanquetEnquiryForm slug={slug} restaurantName={restaurant.name} />
        </div>
      </div>
    </div>
  );
}
