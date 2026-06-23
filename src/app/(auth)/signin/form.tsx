"use client";

import { useActionState, useState } from "react";
import { signinAction, verifyAdminOtpAction, sendAdminEmailOtpAction } from "@/lib/auth/actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { GoogleButton, AuthDivider } from "@/components/google-button";
import type { ActionState } from "@/lib/validation";

export function SigninForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(signinAction, {});
  const [otpState, otpAction, otpPending] = useActionState<ActionState, FormData>(
    verifyAdminOtpAction,
    {},
  );
  const [emailState, emailAction, emailPending] = useActionState<ActionState, FormData>(
    sendAdminEmailOtpAction,
    {},
  );
  const [email, setEmail] = useState("");

  // After a correct super-admin password, signinAction returns otp:true.
  if (state.otp) {
    // Token from the password step (persists across resend/failed-verify).
    const otpToken = otpState.otpToken ?? emailState.otpToken ?? state.otpToken ?? "";
    return (
      <div className="space-y-4">
        {otpState.error && <Alert>{otpState.error}</Alert>}
        {emailState.message && <Alert variant="success">{emailState.message}</Alert>}
        <p className="text-sm text-ink/60">
          Enter the 6-digit code from your <strong>authenticator app</strong>, or use an emailed code.
        </p>
        <form action={otpAction} className="space-y-4">
          <input type="hidden" name="token" value={otpToken} />
          <Field label="Sign-in code" htmlFor="code">
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={otpPending}>
            {otpPending ? "Verifying…" : "Verify & sign in"}
          </Button>
        </form>
        <form action={emailAction} className="text-center">
          <input type="hidden" name="token" value={otpToken} />
          <button type="submit" disabled={emailPending} className="text-sm text-brand-600 hover:underline disabled:opacity-60">
            {emailPending ? "Sending…" : "Email me a code instead"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton />
          <AuthDivider />
        </>
      )}
      <form action={action} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@restaurant.com"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" placeholder="••••••••" required />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      </form>
    </div>
  );
}
