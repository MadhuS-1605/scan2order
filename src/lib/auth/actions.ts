"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, createMfaToken, verifyMfaToken } from "@/lib/auth/session";
import {
  signupSchema,
  signinSchema,
  staffSigninSchema,
  type ActionState,
} from "@/lib/validation";
import { landingFor } from "@/lib/auth/permissions";
import { rateLimit } from "@/lib/ratelimit";
import { flagEnabled } from "@/lib/platform/flags";
import { env } from "@/lib/env";
import { createOtp, verifyOtp } from "@/lib/messaging/otp";
import { sendEmail } from "@/lib/messaging/provider";
import { verifyTotpStep } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";

// Email a fresh admin sign-in code (used at login and on "email me a code").
async function sendAdminEmailCode(email: string): Promise<void> {
  const code = await createOtp(email, "ADMIN_LOGIN");
  await sendEmail(
    email,
    "Your admin sign-in code",
    `<p>Your sign-in code is <strong style="font-size:20px">${code}</strong>.</p><p>It expires in 5 minutes. If you didn't try to sign in, ignore this email.</p>`,
  );
}

// Throttle login attempts to blunt brute-force: a short burst gap + a cap per
// 15-minute window, keyed per account.
const LOGIN_LIMIT = { windowMs: 15 * 60_000, max: 8, minGapMs: 500, failClosed: true };

// Client IP from the proxy header, for IP-keyed throttles (signup / set-password).
async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim() || "unknown";
}

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!(await flagEnabled("signups_enabled"))) {
    return { error: "New sign-ups are temporarily disabled. Please check back soon." };
  }
  if (!(await rateLimit(`signup:${await clientIp()}`, { windowMs: 60 * 60_000, max: 10 }))) {
    return { error: "Too many sign-up attempts. Please try again later." };
  }
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const user = await prisma.adminUser.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "OWNER",
    },
  });

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: null,
  });

  redirect("/onboarding");
}

export async function signinAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  if (!(await rateLimit(`login:${email.toLowerCase()}`, LOGIN_LIMIT))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  // Super-admin second factor. Required when an authenticator is enrolled, or
  // when 2FA is force-enabled by env. The diner/owner login is unaffected.
  const requires2FA = user.isSuperAdmin && (env.superAdmin2fa || user.totpEnabled);
  if (requires2FA && (user.totpEnabled || user.email)) {
    // Hand the client a short-lived token proving the password step passed; the
    // OTP step requires it (so it can't be reached with email + code alone).
    const otpToken = await createMfaToken(user.id);
    if (!user.totpEnabled && user.email) await sendAdminEmailCode(user.email);
    return { ok: true, otp: true, otpToken };
  }
  // If 2FA is forced but the account has no usable factor, fall through rather
  // than lock the operator out.

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });

  if (user.restaurantId) redirect(landingFor(user.role));
  // No restaurant: a platform super-admin goes straight to the console; a brand
  // new owner goes to onboarding to create their restaurant.
  redirect(user.isSuperAdmin ? "/superadmin" : "/onboarding");
}

// Set a password from a one-time invite token (operator-created owners), then
// sign in and head to onboarding.
export async function setPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!token) return { error: "Invalid invite link." };
  if (!(await rateLimit(`setpw:${await clientIp()}`, { windowMs: 15 * 60_000, max: 20, failClosed: true }))) {
    return { error: "Too many attempts. Please wait a few minutes." };
  }
  const user = await prisma.adminUser.findFirst({
    where: { inviteToken: token, inviteTokenExpiry: { gt: new Date() }, disabled: false },
  });
  if (!user) return { error: "This invite link is invalid or has expired." };
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password), inviteToken: null, inviteTokenExpiry: null },
  });
  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });
  redirect(user.restaurantId ? landingFor(user.role) : "/onboarding");
}

// Step 2 of super-admin 2FA: verify the emailed code, then open the session.
export async function verifyAdminOtpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  // The token (from the password step) identifies the user — never trust a
  // client-supplied email/userId here.
  const userId = await verifyMfaToken(token);
  if (!userId) return { error: "Your sign-in session expired. Please sign in again." };
  if (!code) return { error: "Enter your code.", otp: true, otpToken: token };
  // Blunt brute-force on the 2FA step (on top of the per-code attempt cap).
  if (!(await rateLimit(`admin-2fa:${userId}`, { windowMs: 15 * 60_000, max: 12, failClosed: true }))) {
    return { error: "Too many attempts. Please wait a few minutes.", otp: true, otpToken: token };
  }

  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (!user || user.disabled || !user.isSuperAdmin) {
    return { error: "This account can't sign in." };
  }
  // Accept EITHER an authenticator (TOTP) code or an emailed code. For TOTP,
  // reject a code from a step already used (replay within the validity window).
  const totpStep =
    user.totpEnabled && user.totpSecret ? verifyTotpStep(decryptSecret(user.totpSecret), code) : null;
  const totpOk = totpStep !== null && (user.lastTotpStep == null || totpStep > user.lastTotpStep);
  const emailOk = totpOk || !user.email ? false : (await verifyOtp(user.email, "ADMIN_LOGIN", code)).ok;
  if (!totpOk && !emailOk) {
    return { error: "Invalid or expired code.", otp: true, otpToken: token };
  }
  if (totpOk && totpStep !== null) {
    await prisma.adminUser.update({ where: { id: user.id }, data: { lastTotpStep: totpStep } });
  }
  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });
  redirect(user.restaurantId ? landingFor(user.role) : "/superadmin");
}

// "Email me a code instead" — resends the email OTP, identified by the password-
// step token (not a client-supplied email).
export async function sendAdminEmailOtpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const userId = await verifyMfaToken(token);
  if (!userId) return { error: "Your sign-in session expired. Please sign in again." };
  const user = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, disabled: true, email: true },
  });
  if (user?.isSuperAdmin && !user.disabled && user.email) await sendAdminEmailCode(user.email);
  return { ok: true, otp: true, otpToken: token, message: "A code is on its way to your email." };
}

// Staff sign in scoped to their restaurant's code (subdomain) + username. The
// restaurant code arrives from the URL (/r/<code>/signin) as a hidden field.
export async function staffSigninAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = staffSigninSchema.safeParse({
    code: formData.get("code"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { code, username, password } = parsed.data;

  if (!(await rateLimit(`login:${code.toLowerCase()}:${username.toLowerCase()}`, LOGIN_LIMIT))) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const user = await prisma.adminUser.findFirst({
    where: {
      username: username.toLowerCase(),
      disabled: false,
      restaurant: { subdomain: code.toLowerCase() },
    },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect username or password." };
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });

  redirect(landingFor(user.role));
}

export async function signoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
