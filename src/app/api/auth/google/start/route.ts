import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { env } from "@/lib/env";
import { googleAuthUrl } from "@/lib/auth/google";
import { getBaseUrl } from "@/lib/request";

// Kick off the Google OAuth flow: set a short-lived state cookie (CSRF guard)
// and redirect to Google's consent screen.
export async function GET(request: Request) {
  if (!env.google.configured()) {
    return NextResponse.redirect(new URL("/signin?error=google_unavailable", request.url));
  }
  const state = randomBytes(16).toString("hex");
  const baseUrl = await getBaseUrl();
  const res = NextResponse.redirect(googleAuthUrl(state, baseUrl));
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
