"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin, requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { validateSubdomain } from "@/lib/subdomain";
import { syncSubdomain } from "@/lib/cloudflare";

// Live availability check used by the onboarding + settings forms.
export async function checkSubdomainAction(value: string): Promise<{
  available: boolean;
  error?: string;
}> {
  const session = await requireAdmin();
  const v = validateSubdomain(value);
  if (!v.ok) return { available: false, error: v.error };

  const taken = await prisma.restaurant.findFirst({
    where: { subdomain: v.value, NOT: { id: session.restaurantId ?? "" } },
    select: { id: true },
  });
  return taken
    ? { available: false, error: "Already taken." }
    : { available: true };
}

// Manage subdomain + custom domain from Settings (owner/manager).
export async function updateTenantAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "settings")) return;

  const sub = validateSubdomain(String(formData.get("subdomain") ?? ""));
  const customDomain =
    String(formData.get("customDomain") ?? "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "") || null;

  if (sub.ok) {
    const taken = await prisma.restaurant.findFirst({
      where: { subdomain: sub.value, NOT: { id: session.restaurantId } },
      select: { id: true },
    });
    if (!taken) {
      const prev = await prisma.restaurant.findUnique({
        where: { id: session.restaurantId },
        select: { subdomain: true },
      });
      await prisma.restaurant.update({
        where: { id: session.restaurantId },
        data: { subdomain: sub.value },
      });
      // Reconcile Cloudflare DNS (drops the previous record on rename).
      await syncSubdomain(prev?.subdomain, sub.value);
    }
  }

  await prisma.onboardingConfig.update({
    where: { restaurantId: session.restaurantId },
    data: { customDomain },
  });
  await recordAudit(
    session.restaurantId,
    session,
    "settings.web_address",
    [sub.ok ? sub.value : null, customDomain].filter(Boolean).join(" · "),
  );
  revalidatePath("/admin/settings");
}
