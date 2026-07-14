import "server-only";
import { prisma } from "@/lib/db";
import { planLimits } from "@/lib/plans";
import { effectiveTierOf as tierOf } from "@/lib/billing/effective-tier";

// True when the restaurant has hit its plan's table cap (excludes the
// self-service COUNTER pseudo-table, which isn't a real table).
export async function tableQuotaReached(restaurantId: string): Promise<boolean> {
  const max = planLimits(await tierOf(restaurantId)).maxTables;
  if (max == null) return false;
  const count = await prisma.restaurantTable.count({
    where: { restaurantId, kind: { not: "COUNTER" } },
  });
  return count >= max;
}

export async function menuItemQuotaReached(restaurantId: string): Promise<boolean> {
  const max = planLimits(await tierOf(restaurantId)).maxMenuItems;
  if (max == null) return false;
  const count = await prisma.menuItem.count({ where: { restaurantId } });
  return count >= max;
}

export async function plan(restaurantId: string) {
  return planLimits(await tierOf(restaurantId));
}
