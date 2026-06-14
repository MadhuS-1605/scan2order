import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/auth/permissions";

// Require a logged-in admin. Redirects to /signin if absent. Re-checks the DB so
// a disabled/deleted account is rejected immediately (not after the JWT expires),
// and refreshes role/restaurantId from the DB so role changes apply live.
// (We only redirect here — not destroySession — because cookies can't be mutated
// during a page render; the guard simply rejects every request while disabled.)
// Tradeoff: this adds one indexed lookup per admin request. That's deliberate —
// it's what makes disable/role changes take effect live. If it ever shows up in
// profiling, cache it for a few seconds (accepting that much propagation lag);
// don't drop the check or disabling a compromised account stops being immediate.
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/signin");
  const user = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { disabled: true, role: true, restaurantId: true },
  });
  if (!user || user.disabled) redirect("/signin");
  return {
    ...session,
    role: user.role,
    restaurantId: user.restaurantId,
  };
}

// Require an admin who has completed onboarding (has a restaurant).
// Redirects unfinished accounts into the onboarding wizard.
export async function requireOnboardedAdmin(): Promise<
  SessionPayload & { restaurantId: string }
> {
  const session = await requireAdmin();
  if (!session.restaurantId) redirect("/onboarding");
  return session as SessionPayload & { restaurantId: string };
}

// Require an onboarded admin who also holds a specific permission. Server
// Actions are independent endpoints, so they must re-check the role themselves
// (page-level gating doesn't protect them).
export async function requireAdminWithPermission(
  perm: Permission,
): Promise<SessionPayload & { restaurantId: string }> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, perm)) {
    throw new Error("You don't have permission for this action.");
  }
  return session;
}
