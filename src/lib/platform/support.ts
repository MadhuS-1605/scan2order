"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { recordPlatformAudit } from "@/lib/audit";
import type { ActionState } from "@/lib/validation";

async function requireSupportOperator() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "tenants.manage")) redirect("/superadmin");
  return s;
}

function revalidate() {
  revalidatePath("/superadmin/support");
}

export async function createSupportTicketAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSupportOperator();
  const subject = String(formData.get("subject") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const restaurantId = String(formData.get("restaurantId") ?? "").trim() || null;
  if (!subject) return { error: "Enter a subject." };

  await prisma.supportTicket.create({
    data: { subject, description: description || null, restaurantId },
  });
  await recordPlatformAudit(session, "support.created", subject, restaurantId);
  revalidate();
  return { ok: true, message: "Logged." };
}

export async function resolveSupportTicketAction(formData: FormData): Promise<void> {
  const session = await requireSupportOperator();
  const id = String(formData.get("id"));
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) return;
  await prisma.supportTicket.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: new Date() },
  });
  await recordPlatformAudit(session, "support.resolved", t.subject, t.restaurantId);
  revalidate();
}

export async function reopenSupportTicketAction(formData: FormData): Promise<void> {
  const session = await requireSupportOperator();
  const id = String(formData.get("id"));
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) return;
  await prisma.supportTicket.update({
    where: { id },
    data: { status: "OPEN", resolvedAt: null },
  });
  await recordPlatformAudit(session, "support.reopened", t.subject, t.restaurantId);
  revalidate();
}

export async function deleteSupportTicketAction(formData: FormData): Promise<void> {
  const session = await requireSupportOperator();
  const id = String(formData.get("id"));
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) return;
  await prisma.supportTicket.delete({ where: { id } });
  await recordPlatformAudit(session, "support.deleted", t.subject, t.restaurantId);
  revalidate();
}
