import "server-only";
import { tierIncludes, type Capability } from "@/lib/plans";
import { effectiveTierOf } from "@/lib/billing/effective-tier";

// Server-side capability gate. The tier "in force" is the effective tier (a
// lapsed paid plan soft-downgrades to FREE), so gating always reflects what the
// venue is actually paying for right now.

export async function hasCapability(
  restaurantId: string,
  cap: Capability,
): Promise<boolean> {
  return tierIncludes(await effectiveTierOf(restaurantId), cap);
}
