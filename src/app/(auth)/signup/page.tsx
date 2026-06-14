import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { SignupForm } from "./form";

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect(session.restaurantId ? "/admin" : "/onboarding");

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-8">
      <h1 className="font-display text-3xl text-ink">
        Register your restaurant
      </h1>
      <p className="mt-1.5 text-sm text-ink/55">
        Create an owner account to get started.
      </p>
      <div className="mt-6">
        <SignupForm />
      </div>
      <p className="mt-6 text-center text-sm text-ink/55">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
