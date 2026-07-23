import Link from "next/link";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { FloorLayoutEditor } from "./floor-layout-editor";

export default async function FloorLayoutPage() {
  const { restaurant } = await getCurrentRestaurant("tables");

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, isActive: true, kind: { not: "COUNTER" } },
    orderBy: { label: "asc" },
    select: { id: true, label: true, kind: true, posX: true, posY: true },
  });

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/floor" className="text-sm text-ink/45 hover:text-ink">
          ← Floor
        </Link>
        <h1 className="font-display text-3xl font-medium text-ink">Floor plan layout</h1>
      </div>
      {tables.length === 0 ? (
        <p className="text-sm text-ink/55">Add tables first, then arrange them here.</p>
      ) : (
        <FloorLayoutEditor tables={tables} />
      )}
    </div>
  );
}
