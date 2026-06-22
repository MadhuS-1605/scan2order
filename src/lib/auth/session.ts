import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const COOKIE_NAME = "sto_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type SessionPayload = {
  sub: string; // AdminUser id
  email: string | null; // null for staff who sign in with a username
  name: string;
  role: string;
  restaurantId: string | null;
  // Set only while a super-admin is impersonating a tenant: the session runs AS
  // the tenant owner (sub/role/restaurantId are theirs), and these carry the
  // real super-admin so we can show an "acting as" banner and exit cleanly.
  impersonatorId?: string | null;
  impersonatorName?: string | null;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.authSecret());
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  // Next.js 16: cookies() is async.
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      sub: String(payload.sub),
      email: payload.email ? String(payload.email) : null,
      name: String(payload.name),
      role: String(payload.role),
      restaurantId: payload.restaurantId
        ? String(payload.restaurantId)
        : null,
      impersonatorId: payload.impersonatorId
        ? String(payload.impersonatorId)
        : null,
      impersonatorName: payload.impersonatorName
        ? String(payload.impersonatorName)
        : null,
    };
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// Short-lived token proving the PASSWORD step passed, handed to the client between
// the two 2FA steps so the OTP step can't be reached without a valid password.
const MFA_MAX_AGE_SECONDS = 10 * 60;

export async function createMfaToken(userId: string): Promise<string> {
  return new SignJWT({ typ: "mfa" })
    .setSubject(userId)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyMfaToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ !== "mfa" || !payload.sub) return null;
    return String(payload.sub);
  } catch {
    return null;
  }
}
