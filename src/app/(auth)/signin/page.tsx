import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SigninForm } from "./form";

export default async function SigninPage() {
  const session = await getSession();
  if (session) redirect(session.restaurantId ? "/admin" : "/onboarding");

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-8">
      <h1 className="font-display text-3xl text-ink">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink/55">
        Sign in to your restaurant dashboard.
      </p>
      <div className="mt-6">
        <SigninForm />
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
