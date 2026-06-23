import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { Alert } from "@/components/ui";
import { SigninForm } from "./form";

// Map OAuth callback error codes (?error=…) to friendly messages.
const OAUTH_ERRORS: Record<string, string> = {
  google_unavailable: "Google sign-in isn't available right now. Use email & password.",
  google_state: "That sign-in attempt expired. Please try again.",
  google_failed: "Couldn't complete Google sign-in. Please try again.",
  google_unverified: "Your Google account email isn't verified.",
  google_superadmin: "Admin accounts must sign in with email & password.",
  disabled: "This account has been disabled.",
  signups_disabled: "New sign-ups are temporarily disabled.",
};

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? (OAUTH_ERRORS[error] ?? null) : null;
  const session = await getSession();
  if (session) {
    // Validate against the DB before redirecting — a cookie can outlive its user
    // (account deleted / DB reseeded). Trusting the raw JWT would bounce to
    // /admin, which re-checks the DB and bounces back here -> redirect loop. If
    // the user is gone/disabled, fall through and show the form (a fresh sign-in
    // overwrites the stale cookie).
    const user = await prisma.adminUser.findUnique({
      where: { id: session.sub },
      select: { disabled: true, restaurantId: true, isSuperAdmin: true },
    });
    if (user && !user.disabled) {
      redirect(
        user.restaurantId ? "/admin" : user.isSuperAdmin ? "/superadmin" : "/onboarding",
      );
    }
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-8">
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink/55">
        Sign in to your restaurant dashboard.
      </p>
      {errorMessage && (
        <div className="mt-4">
          <Alert>{errorMessage}</Alert>
        </div>
      )}
      <div className="mt-6">
        <SigninForm googleEnabled={env.google.configured()} />
      </div>
      <p className="mt-6 text-center text-sm text-ink/55">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Register your restaurant
        </Link>
      </p>
    </div>
  );
}
