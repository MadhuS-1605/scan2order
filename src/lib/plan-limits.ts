import "server-only";
import { prisma } from "@/lib/db";
import { planLimits } from "@/lib/plans";
import { subscriptionState } from "@/lib/subscription";

// The tier actually in force right now — a lapsed paid plan falls back to FREE.
async function tierOf(restaurantId: string): Promise<string> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { planTier: true, planActiveUntil: true, planIsTrial: true },
  });
  if (!r) return "FREE";
  return subscriptionState(r).effectiveTier;
}

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
