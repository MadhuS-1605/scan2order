import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { exchangeGoogleCode, verifyGoogleIdToken } from "@/lib/auth/google";
import { createSession } from "@/lib/auth/session";
import { landingFor } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { flagEnabled } from "@/lib/platform/flags";

function bounce(request: Request, error: string) {
  const res = NextResponse.redirect(new URL(`/signin?error=${error}`, request.url));
  res.cookies.delete("g_oauth_state");
  return res;
}

export async function GET(request: Request) {
  if (!env.google.configured()) return bounce(request, "google_unavailable");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers.get("cookie")?.match(/(?:^|;\s*)g_oauth_state=([^;]+)/)?.[1];

  // CSRF: the state we set in the start route must round-trip exactly.
  if (!code || !state || !cookieState || state !== cookieState) {
    return bounce(request, "google_state");
  }

  let profile;
  try {
    const idToken = await exchangeGoogleCode(code);
    profile = await verifyGoogleIdToken(idToken);
  } catch {
    return bounce(request, "google_failed");
  }
  if (!profile.emailVerified) return bounce(request, "google_unverified");

  let user = await prisma.adminUser.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
  });

  if (user) {
    if (user.disabled) return bounce(request, "disabled");
    // Google sign-in skips the password + 2FA factors, so don't let it become a
    // back-door around operator 2FA — super-admins must use email + password.
    if (user.isSuperAdmin) return bounce(request, "google_superadmin");
    if (!user.googleId) {
      user = await prisma.adminUser.update({
        where: { id: user.id },
        data: { googleId: profile.sub },
      });
    }
  } else {
    // New account via Google == a sign-up; honour the platform kill-switch.
    if (!(await flagEnabled("signups_enabled"))) return bounce(request, "signups_disabled");
    user = await prisma.adminUser.create({
      data: {
        name: profile.name,
        email: profile.email,
        googleId: profile.sub,
        // No usable password (Google-only); store a random hash to satisfy the
        // required column. The owner can use "email me a code" style flows later.
        passwordHash: await hashPassword(randomBytes(32).toString("hex")),
        role: "OWNER",
      },
    });
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });

  const dest = user.restaurantId ? landingFor(user.role) : "/onboarding";
  const res = NextResponse.redirect(new URL(dest, request.url));
  res.cookies.delete("g_oauth_state");
  return res;
}
