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
  revalidatePath("/admin/inventory/suppliers");
}

export async function createSupplierAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.supplier.create({
    data: {
      restaurantId: session.restaurantId,
      name,
      phone: String(formData.get("phone") ?? "").trim() || null,
      email: String(formData.get("email") ?? "").trim() || null,
    },
  });
  revalidate();
}

export async function deleteSupplierAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  await prisma.supplier.deleteMany({ where: { id, restaurantId: session.restaurantId } });
  revalidate();
}

// One ingredient line at a time — kept simple: repeat to build a multi-line
// order (each call either creates a new DRAFT PO for the supplier or adds to
// the supplier's existing open DRAFT).
export async function addPurchaseOrderLineAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const supplierId = String(formData.get("supplierId"));
  const ingredientId = String(formData.get("ingredientId"));
  const qty = Math.max(0, Number(formData.get("qty") ?? 0) || 0);
  const unitCost = Math.max(0, Number(formData.get("unitCost") ?? 0) || 0);
  if (!supplierId || !ingredientId || qty <= 0) return;

  const [supplier, ingredient] = await Promise.all([
    prisma.supplier.findFirst({ where: { id: supplierId, restaurantId: session.restaurantId } }),
    prisma.ingredient.findFirst({ where: { id: ingredientId, restaurantId: session.restaurantId } }),
  ]);
  if (!supplier || !ingredient) return;

  let po = await prisma.purchaseOrder.findFirst({
    where: { restaurantId: session.restaurantId, supplierId, status: "DRAFT" },
  });
  if (!po) {
    po = await prisma.purchaseOrder.create({
      data: { restaurantId: session.restaurantId, supplierId, status: "DRAFT", createdByName: session.name },
    });
  }
  await prisma.purchaseOrderLine.create({
    data: { purchaseOrderId: po.id, ingredientId, qty, unitCost },
  });
  revalidate();
}

// Marks a DRAFT/ORDERED purchase order RECEIVED: tops up each line's
// ingredient stock and logs a RESTOCK ledger entry per line, atomically.
export async function receivePurchaseOrderAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  const po = await prisma.purchaseOrder.findFirst({
    where: { id, restaurantId: session.restaurantId, status: { not: "RECEIVED" } },
    include: { lines: true },
  });
  if (!po) return;

  await prisma.$transaction(async (tx) => {
    // The status flip is the guard: two concurrent submits (double-click, a
    // retried request) both passing the findFirst check above before either
    // writes would otherwise double-credit every line's ingredient stock.
    // updateMany's affected-row-count makes it atomic — only the first one
    // to land actually flips RECEIVED and applies the stock increments.
    const flipped = await tx.purchaseOrder.updateMany({
      where: { id, status: { not: "RECEIVED" } },
      data: { status: "RECEIVED", receivedAt: new Date() },
    });
    if (flipped.count === 0) return;

    for (const l of po.lines) {
      await tx.ingredient.update({
        where: { id: l.ingredientId },
        data: { stockQty: { increment: l.qty } },
      });
      await tx.ingredientLedgerEntry.create({
        data: {
          restaurantId: session.restaurantId,
          ingredientId: l.ingredientId,
          delta: l.qty,
          reason: "RESTOCK",
          note: `PO ${po.id.slice(-6)}`,
          createdByName: session.name,
        },
      });
    }
  });
  revalidate();
  revalidatePath("/admin/inventory/reports");
}

export async function deletePurchaseOrderAction(formData: FormData): Promise<void> {
  const session = await requireMenuManager();
  const id = String(formData.get("id"));
  await prisma.purchaseOrder.deleteMany({
    where: { id, restaurantId: session.restaurantId, status: { not: "RECEIVED" } },
  });
  revalidate();
}
