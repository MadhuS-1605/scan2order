import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { StaffSigninForm } from "./form";

// Restaurant-scoped staff sign in. Canonical prod URL is the subdomain
// (spicegarden.scan.to/signin → rewritten here by proxy.ts); the /r/<code>/signin
// path also works directly for local/LAN testing.
export default async function StaffSigninPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const session = await getSession();
  if (session) redirect(session.restaurantId ? "/admin" : "/onboarding");

  const restaurant = await prisma.restaurant.findUnique({
    where: { subdomain: code.toLowerCase() },
    select: { name: true },
  });

  if (!restaurant) {
    return (
      <div className="rounded-xl border border-sand-200 bg-surface p-8 text-center">
        <h1 className="font-display text-2xl text-ink">Restaurant not found</h1>
        <p className="mt-2 text-sm text-ink/55">
          We couldn&apos;t find a restaurant at <span className="font-medium">{code}</span>.
          Check the link your manager gave you.
        </p>
        <Link
          href="/signin"
          className="mt-5 inline-block text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Owner sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-8">
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-brand-600">
        {restaurant.name}
      </p>
      <h1 className="mt-1 font-display text-3xl text-ink">Staff sign in</h1>
      <p className="mt-1.5 text-sm text-ink/55">
        Use the username &amp; password your restaurant gave you.
      </p>
      <div className="mt-6">
        <StaffSigninForm code={code.toLowerCase()} />
      </div>
      <p className="mt-6 text-center text-sm text-ink/55">
        Restaurant owner?{" "}
        <Link href="/signin" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in with email
        </Link>
      </p>
    </div>
  );
}
