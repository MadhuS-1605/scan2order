"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";

async function requireMenuManager() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "menu")) throw new Error("Not allowed");
  return session;
}

function revalidate() {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/menu");
}

// Save tracking settings + an exact stock count for an item.
export async function setStockAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const trackStock = formData.get("trackStock") === "on";
  const stockQty = Math.max(0, Math.floor(Number(formData.get("stockQty") ?? 0) || 0));
  const lowStockThreshold = Math.max(
    0,
    Math.floor(Number(formData.get("lowStockThreshold") ?? 0) || 0),
  );
  await prisma.menuItem.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { trackStock, stockQty, lowStockThreshold },
  });
  revalidate();
}

// Quick "+N" restock.
export async function restockAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const amount = Math.floor(Number(formData.get("amount") ?? 0) || 0);
  if (amount === 0) return;
  await prisma.menuItem.updateMany({
    where: { id, restaurantId: session.restaurantId, trackStock: true },
    data: { stockQty: { increment: amount } },
  });
  revalidate();
}
