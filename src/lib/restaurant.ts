import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import {
  hasPermission,
  landingFor,
  type Permission,
} from "@/lib/auth/permissions";

// Loads the signed-in admin's restaurant with its config. Optionally enforces
// a role permission, redirecting unauthorised staff to their landing page.
export async function getCurrentRestaurant(perm?: Permission) {
  const session = await requireOnboardedAdmin();
  if (perm && !hasPermission(session.role, perm)) {
    redirect(landingFor(session.role));
  }
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    include: { config: true },
  });
  if (!restaurant || !restaurant.config) redirect("/onboarding");
  return { session, restaurant, config: restaurant.config };
}
