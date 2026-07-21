"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { getSession, createSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit, recordPlatformAudit } from "@/lib/audit";
import { MENU_TEMPLATES } from "@/lib/templates";
import type { PlanTier } from "@/lib/plans";
import { platformCan, type PlatformRole, type PlatformCapability } from "@/lib/platform/roles";
import { ensureSubdomain, removeSubdomain } from "@/lib/cloudflare";
import { generateTotpSecret, verifyTotp } from "@/lib/auth/totp";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { sendEmail } from "@/lib/messaging/provider";
import { env } from "@/lib/env";
import { randomBytes } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import { setPlanPricing } from "@/lib/plan-settings";
import { escapeHtml } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";
import { setFlag, type FlagKey, FLAGS } from "@/lib/platform/flags";
import type { SessionPayload } from "@/lib/auth/session";

// Super-admin can assign any tier, including ENTERPRISE (no self-serve checkout).
const SUPER_TIERS: PlanTier[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];
const DAY = 86_400_000;

// Apply a starter menu template — creates its categories and items.
export async function applyTemplateAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "menu")) return;
  const key = String(formData.get("template") ?? "");
  const tpl = MENU_TEMPLATES.find((t) => t.key === key);
  if (!tpl) return;

  let sort = await prisma.menuCategory.count({
    where: { restaurantId: session.restaurantId },
  });
  for (const cat of tpl.categories) {
    const category = await prisma.menuCategory.create({
      data: {
        restaurantId: session.restaurantId,
        name: cat.name,
        sortOrder: sort++,
      },
    });
    await prisma.menuItem.createMany({
      data: cat.items.map((it, i) => ({
        restaurantId: session.restaurantId,
        categoryId: category.id,
        name: it.name,
        description: it.description ?? null,
        price: it.price,
        isVeg: it.isVeg ?? true,
        sortOrder: i,
      })),
    });
  }
  await recordAudit(session.restaurantId, session, "menu.template_applied", tpl.name);
  revalidatePath("/admin/menu");
}

// --- Super-admin (platform owner) ---
export type SuperAdminSession = SessionPayload & { platformRole: PlatformRole };

export async function requireSuperAdmin(): Promise<SuperAdminSession> {
  const session = await getSession();
  if (!session) redirect("/signin");
  const user = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { isSuperAdmin: true, platformRole: true },
  });
  if (!user?.isSuperAdmin) redirect("/admin");
  return { ...session, platformRole: user.platformRole };
}

// Require a super-admin who holds a specific platform capability (else throw —
// server actions are independent endpoints, so they must self-check).
export async function requirePlatformCapability(
  cap: PlatformCapability,
): Promise<SuperAdminSession> {
  const session = await requireSuperAdmin();
  if (!platformCan(session.platformRole, cap)) {
    throw new Error("You don't have permission for this platform action.");
  }
  return session;
}

// Apply one action to many tenants at once from the console. Each op is
// capability-gated by the operator's role; idempotent per tenant.
export async function bulkTenantAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdmin();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const op = String(formData.get("op") ?? "");
  if (!ids.length || !op) {
    revalidatePath("/superadmin");
    return;
  }
  const lifecycle = op === "suspend" || op === "reactivate";
  const setPlan = op.startsWith("plan:");
  if (lifecycle && !platformCan(session.platformRole, "tenants.manage")) return;
  if (setPlan && !platformCan(session.platformRole, "billing.manage")) return;

  for (const id of ids) {
    if (op === "suspend") {
      await prisma.restaurant.update({ where: { id }, data: { status: "SUSPENDED", suspendedAt: new Date() } });
    } else if (op === "reactivate") {
      await prisma.restaurant.update({ where: { id }, data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null } });
    } else if (setPlan) {
      const tier = op.slice(5) as PlanTier;
      if (SUPER_TIERS.includes(tier)) {
        await prisma.restaurant.update({ where: { id }, data: { planTier: tier } });
      }
    }
  }
  await recordPlatformAudit(session, `bulk.${op}`, `${ids.length} tenants`);
  revalidatePath("/superadmin");
}

// Grant or extend a paid plan properly: sets the tier AND the active window
// (stacking from the later of now / current expiry, like the billing flow).
// `days` = paid period length; `trial` marks it as a comped trial.
export async function superGrantPlanAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("billing.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const tier = String(formData.get("tier") ?? "") as PlanTier;
  const days = Math.min(3650, Math.max(1, Number(formData.get("days") ?? 30) || 30));
  const trial = formData.get("trial") === "on";
  if (!SUPER_TIERS.includes(tier) || !restaurantId) return;

  if (tier === "FREE") {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { planTier: "FREE", planActiveUntil: null, planIsTrial: false },
    });
  } else {
    const r = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { planActiveUntil: true },
    });
    const base =
      r?.planActiveUntil && r.planActiveUntil.getTime() > Date.now()
        ? r.planActiveUntil.getTime()
        : Date.now();
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        planTier: tier,
        planActiveUntil: new Date(base + days * DAY),
        planIsTrial: trial,
      },
    });
  }
  await recordPlatformAudit(
    session,
    "plan.granted",
    `${tier} · ${tier === "FREE" ? "free" : `${days}d${trial ? " trial" : ""}`}`,
    restaurantId,
  );
  revalidatePath(`/superadmin/restaurants/${restaurantId}`);
  revalidatePath("/superadmin");
}

// Suspend a tenant (blocks its admin until reactivated).
export async function superSuspendAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 300) || null;
  if (!restaurantId) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: reason },
  });
  await recordPlatformAudit(session, "tenant.suspended", reason ?? undefined, restaurantId);
  revalidatePath(`/superadmin/restaurants/${restaurantId}`);
  revalidatePath("/superadmin");
}

export async function superReactivateAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  if (!restaurantId) return;
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { status: "ACTIVE", suspendedAt: null, suspendedReason: null },
  });
  await recordPlatformAudit(session, "tenant.reactivated", undefined, restaurantId);
  revalidatePath(`/superadmin/restaurants/${restaurantId}`);
  revalidatePath("/superadmin");
}

// Impersonate a tenant: re-mint the session AS the venue's owner, tagging the
// real super-admin so the admin UI shows an "acting as" banner and can exit.
export async function startImpersonationAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  if (!restaurantId) return;
  const owner = await prisma.adminUser.findFirst({
    where: { restaurantId, role: "OWNER", disabled: false },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, role: true, restaurantId: true },
  });
  if (!owner) return;
  await recordPlatformAudit(session, "tenant.impersonated", owner.name, restaurantId);
  await createSession({
    sub: owner.id,
    email: owner.email,
    name: owner.name,
    role: owner.role,
    restaurantId: owner.restaurantId,
    impersonatorId: session.sub,
    impersonatorName: session.name,
  });
  redirect("/admin");
}

// Exit impersonation: restore the super-admin's own session.
export async function stopImpersonationAction(): Promise<void> {
  const session = await getSession();
  if (!session?.impersonatorId) redirect("/signin");
  const admin = await prisma.adminUser.findUnique({
    where: { id: session.impersonatorId },
    select: { id: true, email: true, name: true, role: true, restaurantId: true, isSuperAdmin: true },
  });
  if (!admin?.isSuperAdmin) {
    redirect("/signin");
  }
  await recordPlatformAudit(
    { sub: admin.id, name: admin.name },
    "tenant.impersonation_ended",
    undefined,
    session.restaurantId,
  );
  await createSession({
    sub: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    restaurantId: admin.restaurantId,
  });
  redirect("/superadmin");
}

// --- Super-admin authenticator (TOTP) 2FA — self-service ---

// Begin enrolment: generate + store a secret (not yet enabled). The page shows
// its QR; the user confirms a code to enable it.
export async function startTotpEnrollmentAction(): Promise<void> {
  const session = await requireSuperAdmin();
  await prisma.adminUser.update({
    where: { id: session.sub },
    data: { totpSecret: encryptSecret(generateTotpSecret()), totpEnabled: false },
  });
  revalidatePath("/superadmin/security");
}

export async function confirmTotpAction(formData: FormData): Promise<void> {
  const session = await requireSuperAdmin();
  const code = String(formData.get("code") ?? "");
  const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { totpSecret: true } });
  if (!me?.totpSecret || !verifyTotp(decryptSecret(me.totpSecret), code)) {
    revalidatePath("/superadmin/security");
    return; // wrong code — page shows the QR again to retry
  }
  await prisma.adminUser.update({ where: { id: session.sub }, data: { totpEnabled: true } });
  await recordPlatformAudit(session, "twofa.enabled", "authenticator");
  revalidatePath("/superadmin/security");
}

export async function disableTotpAction(): Promise<void> {
  const session = await requireSuperAdmin();
  await prisma.adminUser.update({
    where: { id: session.sub },
    data: { totpSecret: null, totpEnabled: false },
  });
  await recordPlatformAudit(session, "twofa.disabled", "authenticator");
  revalidatePath("/superadmin/security");
}

// --- Announcements (platform banner shown in every tenant admin) ---

export async function createAnnouncementAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const body = String(formData.get("body") ?? "").trim().slice(0, 500) || null;
  const level = formData.get("level") === "WARNING" ? "WARNING" : "INFO";
  if (!title) return;
  await prisma.announcement.create({
    data: { title, body, level, active: true, createdByName: session.name },
  });
  await recordPlatformAudit(session, "announcement.created", title);
  revalidatePath("/superadmin/announcements");
}

export async function toggleAnnouncementAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  await prisma.announcement.update({ where: { id }, data: { active } });
  await recordPlatformAudit(
    session,
    active ? "announcement.activated" : "announcement.deactivated",
    id,
  );
  revalidatePath("/superadmin/announcements");
}

export async function deleteAnnouncementAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.announcement.deleteMany({ where: { id } });
  await recordPlatformAudit(session, "announcement.deleted", id);
  revalidatePath("/superadmin/announcements");
}

// --- Operators (super-admin sub-roles) ---

export async function setPlatformRoleAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as PlatformRole;
  if (!userId || !["FULL", "BILLING", "SUPPORT"].includes(role)) return;
  // Don't let an operator strip their own access and lock everyone out — keep at
  // least self as FULL only via another FULL operator.
  if (userId === session.sub && role !== "FULL") return;
  await prisma.adminUser.updateMany({
    where: { id: userId, isSuperAdmin: true },
    data: { platformRole: role },
  });
  await recordPlatformAudit(session, "operator.role_changed", `${userId.slice(-6)} → ${role}`);
  revalidatePath("/superadmin/operators");
}

// --- Tenant support notes (internal, not visible to the tenant) ---

export async function addTenantNoteAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 1000);
  if (!restaurantId || !body) return;
  await prisma.tenantNote.create({
    data: { restaurantId, body, authorId: session.sub, authorName: session.name },
  });
  await recordPlatformAudit(session, "note.added", undefined, restaurantId);
  revalidatePath(`/superadmin/restaurants/${restaurantId}`);
}

export async function deleteTenantNoteAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const id = String(formData.get("id") ?? "");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  if (!id) return;
  await prisma.tenantNote.deleteMany({ where: { id } });
  await recordPlatformAudit(session, "note.deleted", undefined, restaurantId);
  revalidatePath(`/superadmin/restaurants/${restaurantId}`);
}

// --- Operator-created tenant (invite a new owner) ---

export async function inviteOwnerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requirePlatformCapability("platform.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim().slice(0, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !name) {
    return { error: "Enter the owner's name and a valid email." };
  }
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  // No password yet — issue a one-time set-password token and email the link.
  const token = randomBytes(24).toString("base64url");
  await prisma.adminUser.create({
    data: {
      email,
      name,
      role: "OWNER",
      passwordHash: await hashPassword(randomBytes(18).toString("base64url")), // unusable until set
      inviteToken: token,
      inviteTokenExpiry: new Date(Date.now() + 7 * 86_400_000),
    },
  });
  const url = `${env.appUrl.replace(/\/$/, "")}/set-password/${token}`;
  await sendEmail(
    email,
    "Set up your Scan2Order account",
    `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
      <h2 style="margin:0 0 8px">Welcome, ${escapeHtml(name)} 👋</h2>
      <p>An account has been created for you. Set your password to get started — this link expires in 7 days.</p>
      <p style="margin:16px 0"><a href="${url}" style="background:#d93d0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Set your password</a></p>
    </div>`,
  );
  await recordPlatformAudit(session, "tenant.invited", email);
  return { ok: true, message: `Invite sent to ${email}. They'll set a password and onboard their venue.` };
}

// --- Offboard: permanently delete a tenant (FULL operators only) ---

export async function deleteTenantAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const confirm = String(formData.get("confirm") ?? "").trim();
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { slug: true, subdomain: true, name: true },
  });
  // Require the operator to type the slug to confirm.
  if (!r || confirm !== r.slug) {
    revalidatePath(`/superadmin/restaurants/${restaurantId}`);
    return;
  }
  if (r.subdomain) await removeSubdomain(r.subdomain);
  // Detach admin accounts (relation is SetNull, but be explicit), then delete —
  // child rows cascade via their FK rules.
  await prisma.adminUser.updateMany({ where: { restaurantId }, data: { restaurantId: null } });
  await prisma.restaurant.delete({ where: { id: restaurantId } });
  await recordPlatformAudit(session, "tenant.deleted", r.name, restaurantId);
  redirect("/superadmin");
}

// --- Retention: win-back a lapsed venue ---

export async function sendWinbackAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("tenants.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const r = await prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { name: true, email: true } });
  if (!r?.email) return;
  const url = `${env.appUrl.replace(/\/$/, "")}/admin/billing`;
  await sendEmail(
    r.email,
    `We'd love to have ${r.name} back`,
    `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
      <h2 style="margin:0 0 8px">We miss you at ${escapeHtml(r.name)} 👋</h2>
      <p>Your Scan2Order plan has lapsed. Reactivate today and pick up right where you left off — your menu, tables and history are all still here.</p>
      <p style="margin:16px 0"><a href="${url}" style="background:#d93d0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Reactivate your plan</a></p>
      <p style="color:#999;font-size:12px">Powered by Scan2Order</p>
    </div>`,
  );
  await recordPlatformAudit(session, "tenant.winback", undefined, restaurantId);
  revalidatePath("/superadmin/retention");
}

// --- Subdomain / DNS management ---

export async function resyncSubdomainAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const restaurantId = String(formData.get("restaurantId") ?? "");
  const r = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { subdomain: true },
  });
  if (!r?.subdomain) return;
  await ensureSubdomain(r.subdomain);
  await recordPlatformAudit(session, "subdomain.resynced", r.subdomain, restaurantId);
  revalidatePath("/superadmin/domains");
}

// --- Plan pricing management ---

export async function updatePlanPricingAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("billing.manage");
  const tier = String(formData.get("tier") ?? "");
  if (!["FREE", "STARTER", "PRO", "ENTERPRISE"].includes(tier)) return;
  const price = Math.max(0, Math.floor(Number(formData.get("price") ?? 0) || 0));
  const trialDays = Math.max(0, Math.min(365, Math.floor(Number(formData.get("trialDays") ?? 14) || 14)));
  await setPlanPricing(tier, price, trialDays);
  await recordPlatformAudit(session, "plan.pricing_updated", `${tier} · ₹${price} · ${trialDays}d trial`);
  revalidatePath("/superadmin/plans");
}

// --- Subscription promo codes ---

export async function createPlanCouponAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("billing.manage");
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 40);
  const type = formData.get("type") === "AMOUNT" ? "AMOUNT" : "PERCENT";
  const value = Number(formData.get("value") ?? 0);
  const maxRaw = String(formData.get("maxRedemptions") ?? "").trim();
  const maxRedemptions = maxRaw ? Math.max(1, Math.floor(Number(maxRaw))) : null;
  const expRaw = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = expRaw ? new Date(expRaw) : null;
  if (!code || !Number.isFinite(value) || value <= 0) return;
  if (type === "PERCENT" && value > 100) return;
  await prisma.planCoupon.upsert({
    where: { code },
    create: { code, type, value, maxRedemptions, expiresAt, active: true },
    update: { type, value, maxRedemptions, expiresAt, active: true },
  });
  await recordPlatformAudit(session, "coupon.created", `${code} · ${type} ${value}`);
  revalidatePath("/superadmin/promos");
}

export async function togglePlanCouponAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("billing.manage");
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  await prisma.planCoupon.update({ where: { id }, data: { active } });
  await recordPlatformAudit(session, active ? "coupon.activated" : "coupon.deactivated", id);
  revalidatePath("/superadmin/promos");
}

export async function deletePlanCouponAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("billing.manage");
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.planCoupon.deleteMany({ where: { id } });
  await recordPlatformAudit(session, "coupon.deleted", id);
  revalidatePath("/superadmin/promos");
}

// --- Feature flags (platform kill switches) ---

export async function setFlagAction(formData: FormData): Promise<void> {
  const session = await requirePlatformCapability("platform.manage");
  const key = String(formData.get("key") ?? "") as FlagKey;
  const enabled = formData.get("enabled") === "true";
  if (!FLAGS.some((f) => f.key === key)) return;
  await setFlag(key, enabled);
  await recordPlatformAudit(session, "flag.changed", `${key} = ${enabled ? "on" : "off"}`);
  revalidatePath("/superadmin/flags");
}
