"use client";

import { useActionState } from "react";
import { signinAction } from "@/lib/auth/actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import type { ActionState } from "@/lib/validation";

export function SigninForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    signinAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@restaurant.com"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput
          id="password"
          name="password"
          placeholder="••••••••"
          required
        />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
