import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import {
  requireSuperAdmin,
  startTotpEnrollmentAction,
  confirmTotpAction,
  disableTotpAction,
} from "@/lib/platform/actions";
import { totpUri } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import { qrDataUrl } from "@/lib/qr";

export default async function SecurityPage() {
  const session = await requireSuperAdmin();
  const me = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { email: true, totpSecret: true, totpEnabled: true },
  });
  const enrolling = !!me?.totpSecret && !me.totpEnabled;
  const plainSecret = enrolling && me?.totpSecret ? decryptSecret(me.totpSecret) : null;
  const qr = plainSecret ? await qrDataUrl(totpUri(plainSecret, me?.email ?? "admin")) : null;

  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Security</h1>
        <p className="text-sm text-ink/45">Two-factor authentication for your operator account.</p>
      </div>

      <div className="rounded-2xl border border-sand-200 bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-medium text-ink">Authenticator app</h2>
            <p className="text-sm text-ink/55">
              Use Google Authenticator, Authy, 1Password, etc. Either an app code or an emailed code will work at sign-in.
            </p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${me?.totpEnabled ? "bg-olive-100 text-olive-700" : "bg-sand-100 text-ink/55"}`}>
            {me?.totpEnabled ? "Enabled" : "Off"}
          </span>
        </div>

        {me?.totpEnabled ? (
          <form action={disableTotpAction} className="mt-4">
            <button type="submit" className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
              Disable authenticator
            </button>
          </form>
        ) : enrolling ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink/70">1. Scan this QR in your authenticator app:</p>
            {qr && (
              <span
                className="block h-44 w-44 rounded-lg border border-sand-200 bg-white bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: `url("${qr}")` }}
                aria-label="Authenticator QR code"
              />
            )}
            <p className="text-xs text-ink/50">
              Or enter this key manually: <code className="select-all break-all font-mono text-ink/70">{plainSecret}</code>
            </p>
            <form action={confirmTotpAction} className="flex items-end gap-2">
              <label className="text-xs text-ink/55">
                2. Enter the 6-digit code
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="mt-1 block w-32 rounded-md border border-sand-300 bg-surface px-2 py-1.5 text-sm"
                />
              </label>
              <button type="submit" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                Confirm & enable
              </button>
            </form>
          </div>
        ) : (
          <form action={startTotpEnrollmentAction} className="mt-4">
            <button type="submit" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              Set up authenticator
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-sand-200 bg-surface p-5">
        <h2 className="font-medium text-ink">Email code</h2>
        <p className="mt-1 text-sm text-ink/55">
          {env.superAdmin2fa
            ? `A one-time code can be emailed to ${me?.email ?? "your address"} at sign-in.`
            : "Email 2FA is currently off platform-wide (set SUPERADMIN_2FA to require it). Enabling an authenticator above will require 2FA for your account regardless."}
        </p>
      </div>
    </div>
  );
}
