import "server-only";
import { prisma } from "@/lib/db";
import { subscriptionState } from "@/lib/subscription";

// The plan tier a venue is actually entitled to right now (a lapsed paid plan
// soft-downgrades to FREE). Shared by usage metering, the overage engine, and
// plan limits so they all gate on the same value.
export async function effectiveTierOf(restaurantId: string): Promise<string> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { planTier: true, planActiveUntil: true, planIsTrial: true },
  });
  if (!r) return "FREE";
  return subscriptionState(r).effectiveTier;
}
