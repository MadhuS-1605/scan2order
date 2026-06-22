import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { InviteForm } from "./invite-form";

export default async function OnboardPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "platform.manage")) redirect("/superadmin");

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Invite a venue</h1>
        <p className="text-sm text-ink/45">
          Create an owner account on their behalf. They&apos;ll sign in and complete the venue setup
          (menu, tables, payments) themselves.
        </p>
      </div>
      <div className="rounded-2xl border border-sand-200 bg-surface p-5">
        <InviteForm />
      </div>
    </div>
  );
}
