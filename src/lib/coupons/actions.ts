"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

function randomCodeSuffix(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

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

// Generates N unique single-use codes sharing the same discount config — for
// referral/loyalty campaigns where each recipient needs their own code rather
// than everyone typing the one-at-a-time form to build a batch by hand.
export async function bulkCreateCouponsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireMenuManager();
  const prefix = String(formData.get("prefix") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
  const count = Math.min(500, Math.max(1, Math.floor(Number(formData.get("count") ?? 0) || 0)));
  const type = String(formData.get("type")) === "FLAT" ? "FLAT" : "PERCENT";
  const value = Number(formData.get("value") ?? 0);
  const minOrder = Number(formData.get("minOrder") ?? 0) || 0;
  const maxDiscountRaw = Number(formData.get("maxDiscount") ?? 0);

  if (!count) return { error: "Enter how many codes to generate." };
  if (value <= 0) return { error: "Enter a discount value." };
  if (type === "PERCENT" && value > 100) return { error: "Percentage can't exceed 100." };

  const existing = await prisma.coupon.findMany({
    where: { restaurantId: session.restaurantId },
    select: { code: true },
  });
  const taken = new Set(existing.map((c) => c.code));

  const codes: string[] = [];
  while (codes.length < count) {
    const code = `${prefix}${prefix ? "-" : ""}${randomCodeSuffix()}`;
    if (taken.has(code)) continue; // negligible odds, but never silently collide
    taken.add(code);
    codes.push(code);
  }

  await prisma.coupon.createMany({
    data: codes.map((code) => ({
      restaurantId: session.restaurantId,
      code,
      type: type as "PERCENT" | "FLAT",
      value,
      minOrder,
      maxDiscount: type === "PERCENT" && maxDiscountRaw > 0 ? maxDiscountRaw : null,
      usageLimit: 1, // one redemption per generated code — the batch-code pattern
    })),
  });
  await recordAudit(session.restaurantId, session, "coupon.bulkCreated", `${count} codes (${prefix || "no prefix"})`);
  revalidatePath("/admin/coupons");
  return {
    ok: true,
    message: `Created ${count} code${count === 1 ? "" : "s"}, each single-use:\n${codes.join(", ")}`,
  };
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
