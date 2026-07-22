"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { recordAudit } from "@/lib/audit";
import { staffSchema, resetPasswordSchema, type ActionState } from "@/lib/validation";

const STAFF_ROLES = new Set(["MANAGER", "CASHIER", "WAITER", "KITCHEN"]);
type StaffRole = "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";

// Readable random password — no 0/O/1/l/I so it's unambiguous when handed to
// a waiter to type in, and never shown again after creation.
function randomStaffPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

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

// Bulk-create staff from pasted rows ("name, username, role" per line) with an
// auto-generated password per account — so onboarding 10-20 waiters/cooks
// doesn't mean typing the one-at-a-time form that many times. Passwords are
// shown once in the result message; there's no other way to recover them
// (same as any freshly-created account — use "Reset password" afterward).
export async function bulkCreateStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireStaffManager();
  const rows = String(formData.get("csv") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (rows.length === 0) {
    return { error: "Paste one staff member per line: name, username, role." };
  }

  const existing = await prisma.adminUser.findMany({
    where: { restaurantId: session.restaurantId },
    select: { username: true },
  });
  const taken = new Set(existing.map((u) => u.username).filter(Boolean));

  const created: { name: string; username: string; role: StaffRole; password: string }[] = [];
  const skipped: string[] = [];
  for (const row of rows) {
    const [rawName, rawUsername, rawRole] = row.split(",").map((s) => s.trim());
    const name = rawName?.slice(0, 80);
    const username = rawUsername?.toLowerCase();
    const role = (rawRole || "WAITER").toUpperCase();
    if (
      !name ||
      !username ||
      !/^[a-zA-Z0-9_]{3,30}$/.test(username) ||
      !STAFF_ROLES.has(role) ||
      taken.has(username)
    ) {
      skipped.push(rawUsername || rawName || row);
      continue;
    }
    taken.add(username);
    created.push({ name, username, role: role as StaffRole, password: randomStaffPassword() });
  }

  if (created.length === 0) {
    return { error: "No staff created — check for duplicate usernames or invalid roles (manager/cashier/waiter/kitchen)." };
  }

  for (const c of created) {
    await prisma.adminUser.create({
      data: {
        name: c.name,
        username: c.username,
        passwordHash: await hashPassword(c.password),
        role: c.role,
        restaurantId: session.restaurantId,
      },
    });
    await recordAudit(session.restaurantId, session, "staff.created", `${c.name} (${c.role})`);
  }
  revalidatePath("/admin/staff");

  const lines = created.map((c) => `@${c.username} / ${c.password}`).join("\n");
  const skippedNote = skipped.length ? `\nSkipped: ${skipped.join(", ")}` : "";
  return {
    ok: true,
    message: `Created ${created.length} staff account${created.length === 1 ? "" : "s"}. Save these now — passwords won't be shown again:\n${lines}${skippedNote}`,
  };
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
