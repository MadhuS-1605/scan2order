"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { MENU_TEMPLATES } from "@/lib/templates";
import type { PlanTier } from "@/lib/plans";

const TIERS: PlanTier[] = ["FREE", "STARTER", "PRO"];

// Owner changes their own plan (scaffolding — no payment gateway yet).
export async function setPlanAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "settings")) return;
  const tier = String(formData.get("tier") ?? "") as PlanTier;
  if (!TIERS.includes(tier)) return;
  await prisma.restaurant.update({
    where: { id: session.restaurantId },
    data: { planTier: tier },
  });
  await recordAudit(session.restaurantId, session, "plan.changed", tier);
  revalidatePath("/admin/billing");
}

// Apply a starter menu template — creates its categories and items.
export async function applyTemplateAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "menu")) return;
  const key = String(formData.get("template") ?? "");
  const tpl = MENU_TEMPLATES.find((t) => t.key === key);
  if (!tpl) return;

  let sort = await prisma.menuCategory.count({
    where: { restaurantId: session.restaurantId },
  });
  for (const cat of tpl.categories) {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: session.restaurantId,
        name: cat.name,
        sortOrder: sort++,
      },
    });
    await prisma.menuItem.createMany({
      data: cat.items.map((it, i) => ({
        restaurantId: session.restaurantId,
        categoryId: category.id,
        name: it.name,
        description: it.description ?? null,
        price: it.price,
        isVeg: it.isVeg ?? true,
        sortOrder: i,
      })),
    });
  }
  await recordAudit(session.restaurantId, session, "menu.template_applied", tpl.name);
  revalidatePath("/admin/menu");
}

// --- Super-admin (platform owner) ---
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) redirect("/signin");
  const user = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true },
  });
  if (!user?.isSuperAdmin) redirect("/admin");
  return session;
}

// Super-admin changes any restaurant's plan from the platform console.
export async function superSetPlanAction(formData: FormData): Promise<void> {
  await requireSuperAdmin();
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const tier = String(formData.get("tier") ?? "") as PlanTier;
  if (!TIERS.includes(tier) || !restaurantId) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { planTier: tier },
  });
  revalidatePath("/superadmin");
}
