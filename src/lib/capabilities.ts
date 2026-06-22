import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { subscriptionState } from "@/lib/subscription";
import { capsForTier, tierIncludes, type Capability } from "@/lib/plans";

// Server-side capability gate. The tier "in force" is the effective tier (a
// lapsed paid plan soft-downgrades to FREE), so gating always reflects what the
// venue is actually paying for right now.

async function effectiveTier(restaurantId: string): Promise<string> {
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { planTier: true, planActiveUntil: true, planIsTrial: true },
  });
  if (!r) return "FREE";
  return subscriptionState(r).effectiveTier;
}

// All capabilities the venue currently has (for nav/UI lock states).
export async function restaurantCaps(restaurantId: string): Promise<Capability[]> {
  return capsForTier(await effectiveTier(restaurantId));
}

export async function hasCapability(
  restaurantId: string,
  cap: Capability,
): Promise<boolean> {
  return tierIncludes(await effectiveTier(restaurantId), cap);
}

// Page guard: bounce to the billing screen (with an ?upgrade hint) when the tier
// doesn't include a capability. Use at the top of a gated admin page/server
// action that the nav would otherwise show locked.
export async function requireCapability(
  restaurantId: string,
  cap: Capability,
): Promise<void> {
  if (!(await hasCapability(restaurantId, cap))) {
    redirect(`/admin/billing?upgrade=${cap}`);
  }
}
