"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import {
  requestLoginOtpAction,
  verifyLoginOtpAction,
} from "@/lib/account/actions";
import { Button, Input, Alert } from "@/components/ui";

export function AccountLogin() {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mocked, setMocked] = useState(false);

  async function send() {
    setErr(null);
    setBusy(true);
    try {
      const res = await requestLoginOtpAction({ phone });
      if (!res.ok) return setErr(res.error ?? "Could not send code.");
      setMocked(Boolean(res.mocked));
      setPhase("otp");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setErr(null);
    setBusy(true);
    try {
      const res = await verifyLoginOtpAction({ phone, code });
      if (!res.ok) return setErr(res.error ?? "Verification failed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-surface p-6">
      <h1 className="font-display text-2xl text-ink">Your orders</h1>
      <p className="mt-1 text-sm text-ink/55">
        Sign in with your mobile number to see your dining history and reorder.
      </p>

      <div className="mt-5 space-y-3">
        {err && <Alert>{err}</Alert>}

        {phase === "phone" ? (
          <>
            <Input
              placeholder="Mobile number e.g. +9198…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <Button
              className="w-full"
              onClick={send}
              disabled={busy || phone.length < 8}
            >
              <MessageCircle className="h-4 w-4" />
              {busy ? "Sending…" : "Send login code"}
            </Button>
          </>
        ) : (
          <>
            {mocked && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                Test mode — the code was printed to the server console.
              </p>
            )}
            <Input
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              className="text-center text-lg tracking-[0.4em]"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setPhase("phone")} disabled={busy}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button className="flex-1" onClick={verify} disabled={busy || code.length < 4}>
                {busy ? "Verifying…" : "Verify & sign in"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
