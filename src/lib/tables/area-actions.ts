"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";

function revalidate() {
  revalidatePath("/admin/tables");
}

export async function createAreaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("tables");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const count = await prisma.tableArea.count({ where: { restaurantId: session.restaurantId } });
  await prisma.tableArea.create({
    data: { restaurantId: session.restaurantId, name, sortOrder: count },
  });
  revalidate();
}

export async function deleteAreaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("tables");
  const id = String(formData.get("id"));
  // Tables in this area fall back to unassigned (areaId -> null via onDelete: SetNull).
  await prisma.tableArea.deleteMany({ where: { id, restaurantId: session.restaurantId } });
  revalidate();
}

export async function assignTableAreaAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("tables");
  const tableId = String(formData.get("tableId"));
  const areaId = String(formData.get("areaId") ?? "");
  await prisma.restaurantTable.updateMany({
    where: { id: tableId, restaurantId: session.restaurantId },
    data: { areaId: areaId || null },
  });
  revalidate();
}
