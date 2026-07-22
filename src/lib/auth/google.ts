import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "@/lib/env";

// Minimal Google OAuth 2.0 / OpenID Connect helper (no NextAuth). We use the
// authorization-code flow with a confidential client and verify the returned
// id_token against Google's JWKS, so we never trust unverified claims.

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

// baseUrl must be the actual host the browser is on (from getBaseUrl(),
// which honours x-forwarded-host) — NOT env.appUrl. Behind certain
// proxies/containers, request.url and the static NEXT_PUBLIC_APP_URL can
// disagree with the host Google actually round-trips to, which either
// mismatches Google's registered redirect URI or (if it happens to match)
// lands the callback on a host the state cookie was never set on.
export function googleRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function googleAuthUrl(state: string, baseUrl: string): string {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleRedirectUri(baseUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, baseUrl: string): Promise<string> {
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.google.clientId,
      client_secret: env.google.clientSecret,
      redirect_uri: googleRedirectUri(baseUrl),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) throw new Error("Google token response had no id_token");
  return json.id_token;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.google.clientId,
  });
  const email = String(payload.email ?? "").toLowerCase();
  if (!email) throw new Error("Google id_token had no email");
  return {
    sub: String(payload.sub),
    email,
    emailVerified: payload.email_verified === true,
    name: String(payload.name ?? email.split("@")[0]),
  };
}
