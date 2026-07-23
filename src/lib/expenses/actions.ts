"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";

function revalidate() {
  revalidatePath("/admin/expenses");
}

export async function createExpenseAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  const category = String(formData.get("category") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;
  const incurredAtRaw = String(formData.get("incurredAt") ?? "");
  if (!category || !(amount > 0)) return;
  const incurredAt = incurredAtRaw ? new Date(incurredAtRaw) : new Date();
  if (isNaN(incurredAt.getTime())) return;

  await prisma.expense.create({
    data: {
      restaurantId: session.restaurantId,
      category,
      amount,
      note,
      incurredAt,
      createdByName: session.name,
    },
  });
  revalidate();
}

export async function deleteExpenseAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("settings");
  const id = String(formData.get("id"));
  await prisma.expense.deleteMany({ where: { id, restaurantId: session.restaurantId } });
  revalidate();
}
