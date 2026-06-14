"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { staffSchema, resetPasswordSchema, type ActionState } from "@/lib/validation";

async function requireStaffManager() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "staff")) {
    throw new Error("Not allowed");
  }
  return session;
}

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffManager();
  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, username, password, role } = parsed.data;
  const uname = username.toLowerCase();

  const existing = await prisma.adminUser.findFirst({
    where: { restaurantId: session.restaurantId, username: uname },
  });
  if (existing) return { error: "That username is already in use." };

  await prisma.adminUser.create({
    data: {
      name,
      username: uname,
      passwordHash: await hashPassword(password),
      role,
      restaurantId: session.restaurantId,
    },
  });
  await recordAudit(session.restaurantId, session, "staff.created", `${name} (${role})`);
  revalidatePath("/admin/staff");
  return { ok: true, message: `${name} added as ${role.toLowerCase()} · @${uname}` };
}

export async function updateStaffRoleAction(
  formData: FormData,
): Promise<void> {
  const session = await requireStaffManager();
  const id = String(formData.get("id"));
  const role = String(formData.get("role"));
  if (id === session.sub) return; // can't change your own role
  if (!["MANAGER", "CASHIER", "WAITER", "KITCHEN"].includes(role)) return;
  await prisma.adminUser.updateMany({
    where: { id, restaurantId: session.restaurantId, role: { not: "OWNER" } },
    data: { role: role as "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN" },
  });
  await recordAudit(session.restaurantId, session, "staff.role_changed", role);
  revalidatePath("/admin/staff");
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const session = await requireStaffManager();
  const id = String(formData.get("id"));
  if (id === session.sub) return; // can't delete yourself
  await prisma.adminUser.deleteMany({
    where: { id, restaurantId: session.restaurantId, role: { not: "OWNER" } },
  });
  await recordAudit(session.restaurantId, session, "staff.removed");
  revalidatePath("/admin/staff");
}

// Owner re-issues a staff member's password.
export async function resetStaffPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffManager();
  const parsed = resetPasswordSchema.safeParse({
    id: formData.get("id"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { id, password } = parsed.data;
  if (id === session.sub) return { error: "Use your account settings instead." };
  const target = await prisma.adminUser.findFirst({
    where: { id, restaurantId: session.restaurantId, role: { not: "OWNER" } },
    select: { name: true },
  });
  if (!target) return { error: "Staff member not found." };
  await prisma.adminUser.updateMany({
    where: { id, restaurantId: session.restaurantId },
    data: { passwordHash: await hashPassword(password) },
  });
  await recordAudit(session.restaurantId, session, "staff.password_reset", target.name);
  revalidatePath("/admin/staff");
  return { ok: true, message: `Password reset for ${target.name}` };
}

// Suspend / re-enable a staff account (blocks login, keeps history & audit).
export async function setStaffDisabledAction(formData: FormData): Promise<void> {
  const session = await requireStaffManager();
  const id = String(formData.get("id"));
  const disabled = formData.get("disabled") === "true";
  if (id === session.sub) return; // can't disable yourself
  const res = await prisma.adminUser.updateMany({
    where: { id, restaurantId: session.restaurantId, role: { not: "OWNER" } },
    data: { disabled },
  });
  if (res.count > 0) {
    await recordAudit(
      session.restaurantId,
      session,
      disabled ? "staff.disabled" : "staff.enabled",
    );
  }
  revalidatePath("/admin/staff");
}
