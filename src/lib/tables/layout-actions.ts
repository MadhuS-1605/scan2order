"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";

export type TablePosition = { id: string; x: number; y: number };

// Bulk-saves the visual floor-plan layout (drag-and-drop positions, 0-100%
// of the canvas). One call per "Save layout" click rather than per-drag, so
// dragging around doesn't spam the DB.
export async function saveFloorLayoutAction(positions: TablePosition[]): Promise<void> {
  const session = await requireAdminWithPermission("tables");
  const clamped = positions
    .filter((p) => p.id && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ id: p.id, x: Math.max(0, Math.min(100, p.x)), y: Math.max(0, Math.min(100, p.y)) }));
  await prisma.$transaction(
    clamped.map((p) =>
      prisma.restaurantTable.updateMany({
        where: { id: p.id, restaurantId: session.restaurantId },
        data: { posX: p.x, posY: p.y },
      }),
    ),
  );
  revalidatePath("/admin/floor");
  revalidatePath("/admin/floor/layout");
}
