"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

async function requireMenuManager() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "menu")) throw new Error("Not allowed");
  return session;
}

export async function createCouponAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireMenuManager();
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const type = String(formData.get("type")) === "FLAT" ? "FLAT" : "PERCENT";
  const value = Number(formData.get("value") ?? 0);
  const minOrder = Number(formData.get("minOrder") ?? 0) || 0;
  const maxDiscountRaw = Number(formData.get("maxDiscount") ?? 0);
  const usageLimitRaw = Number(formData.get("usageLimit") ?? 0);

  if (!/^[A-Z0-9]{3,20}$/.test(code))
    return { error: "Code must be 3–20 letters/numbers." };
  if (value <= 0) return { error: "Enter a discount value." };
  if (type === "PERCENT" && value > 100)
    return { error: "Percentage can't exceed 100." };

  const exists = await prisma.coupon.findUnique({
    where: { restaurantId_code: { restaurantId: session.restaurantId, code } },
  });
  if (exists) return { error: "That code already exists." };

  await prisma.coupon.create({
    data: {
      restaurantId: session.restaurantId,
      code,
      type,
      value,
      minOrder,
      maxDiscount: type === "PERCENT" && maxDiscountRaw > 0 ? maxDiscountRaw : null,
      usageLimit: usageLimitRaw > 0 ? Math.floor(usageLimitRaw) : null,
    },
  });
  await recordAudit(session.restaurantId, session, "coupon.created", code);
  revalidatePath("/admin/coupons");
  return { ok: true, message: `Coupon ${code} created` };
}

export async function toggleCouponAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const c = await prisma.coupon.findFirst({
    where: { id, restaurantId: session.restaurantId },
  });
  if (!c) return;
  await prisma.coupon.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { active: !c.active },
  });
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  await prisma.coupon.deleteMany({
    where: { id, restaurantId: session.restaurantId },
  });
  await recordAudit(session.restaurantId, session, "coupon.deleted");
  revalidatePath("/admin/coupons");
}
