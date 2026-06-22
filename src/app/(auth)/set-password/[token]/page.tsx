import Link from "next/link";
import { prisma } from "@/lib/db";
import { SetPasswordForm } from "./form";

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await prisma.adminUser.findFirst({
    where: { inviteToken: token, inviteTokenExpiry: { gt: new Date() }, disabled: false },
    select: { name: true, email: true },
  });

  if (!user) {
    return (
      <div className="rounded-xl border border-sand-200 bg-surface p-8">
        <h1 className="font-display text-2xl text-ink">Link expired</h1>
        <p className="mt-2 text-sm text-ink/55">This invite link is invalid or has expired.</p>
        <p className="mt-4 text-sm">
          <Link href="/signin" className="font-medium text-brand-600 hover:text-brand-700">Go to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sand-200 bg-surface p-8">
      <h1 className="font-display text-3xl text-ink">Welcome, {user.name}</h1>
      <p className="mt-1.5 text-sm text-ink/55">Set a password to activate your account ({user.email}).</p>
      <div className="mt-6">
        <SetPasswordForm token={token} />
      </div>
    </div>
  );
}
