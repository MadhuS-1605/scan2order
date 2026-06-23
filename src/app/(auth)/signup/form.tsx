"use client";

import { useActionState } from "react";
import { signupAction } from "@/lib/auth/actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import { GoogleButton, AuthDivider } from "@/components/google-button";
import type { ActionState } from "@/lib/validation";

export function SignupForm({ googleEnabled = false }: { googleEnabled?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    signupAction,
    {},
  );

  return (
    <div>
      {googleEnabled && (
        <>
          <GoogleButton label="Sign up with Google" />
          <AuthDivider />
        </>
      )}
      <form action={action} className="space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" placeholder="Asha Kumar" required />
        </Field>
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@restaurant.com"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <PasswordInput
          id="password"
          name="password"
          placeholder="••••••••"
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
      </form>
    </div>
  );
}
