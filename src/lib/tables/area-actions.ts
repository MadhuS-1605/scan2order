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
  const areaIdRaw = String(formData.get("areaId") ?? "") || null;
  // A <select> only ever offers this tenant's own areas, but a Server Action
  // is invocable with arbitrary FormData — re-verify the area actually
  // belongs to this restaurant before attaching it, same as every other
  // cross-entity reference elsewhere in this codebase.
  const area = areaIdRaw
    ? await prisma.tableArea.findFirst({ where: { id: areaIdRaw, restaurantId: session.restaurantId } })
    : null;
  if (areaIdRaw && !area) return;

  await prisma.restaurantTable.updateMany({
    where: { id: tableId, restaurantId: session.restaurantId },
    data: { areaId: area?.id ?? null },
  });
  revalidate();
}
