"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { toNumber } from "@/lib/utils";

function revalidate() {
  revalidatePath("/admin/cash-shifts");
}

export async function openCashShiftAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const openingFloat = Math.max(0, Number(formData.get("openingFloat") ?? 0) || 0);

  const open = await prisma.cashShift.findFirst({
    where: { adminUserId: session.sub, closedAt: null },
  });
  if (open) return; // one open shift per staff member at a time

  await prisma.cashShift.create({
    data: { restaurantId: session.restaurantId, adminUserId: session.sub, openingFloat },
  });
  revalidate();
}

// Counts up the denomination breakdown from form fields named "denom_<value>".
function parseDenomination(formData: FormData): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("denom_")) continue;
    const denom = Number(key.slice("denom_".length));
    const count = Math.max(0, Math.floor(Number(value) || 0));
    if (denom > 0 && count > 0) {
      breakdown[denom] = count;
      total += denom * count;
    }
  }
  return { total, breakdown };
}

// Closes the staff member's own open shift. Expected cash = opening float +
// paid COUNTER orders during the shift window (see the schema comment on
// CashShift for the updatedAt-as-paidAt approximation this relies on).
export async function closeCashShiftAction(formData: FormData): Promise<void> {
  const session = await requireAdminWithPermission("orders");
  const id = String(formData.get("id"));
  const shift = await prisma.cashShift.findFirst({
    where: { id, restaurantId: session.restaurantId, adminUserId: session.sub, closedAt: null },
  });
  if (!shift) return;

  const closedAt = new Date();
  const paidCounter = await prisma.order.aggregate({
    where: {
      restaurantId: session.restaurantId,
      paymentMethod: "COUNTER",
      paymentStatus: "PAID",
      updatedAt: { gte: shift.openedAt, lte: closedAt },
    },
    _sum: { amountPaid: true },
  });
  const expectedCash = toNumber(shift.openingFloat) + toNumber(paidCounter._sum.amountPaid ?? 0);
  const { total: closingCounted, breakdown } = parseDenomination(formData);
  const variance = closingCounted - expectedCash;

  await prisma.cashShift.update({
    where: { id },
    data: {
      closedAt,
      closingCounted,
      expectedCash,
      variance,
      denomination: breakdown,
    },
  });
  revalidate();
}
