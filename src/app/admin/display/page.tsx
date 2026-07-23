import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { seatLabel } from "@/lib/utils";

// Picks which table/counter's live order to show on a customer-facing
// second screen at the register — see /admin/display/[tableId].
export default async function DisplayPickerPage() {
  const { restaurant } = await getCurrentRestaurant("orders");

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    orderBy: { label: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Customer display</h1>
        <p className="text-sm text-ink/55">
          Pick a table or counter to show its running order on a customer-facing screen.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((tbl) => (
          <Link
            key={tbl.id}
            href={`/admin/display/${tbl.id}`}
            target="_blank"
            className="rounded-2xl border border-sand-200 bg-surface p-4 text-center font-medium text-ink hover:border-brand-300"
          >
            {seatLabel(tbl)}
          </Link>
        ))}
      </div>
    </div>
  );
}
