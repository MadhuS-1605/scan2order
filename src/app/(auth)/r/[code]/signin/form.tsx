"use client";

import { useActionState } from "react";
import { staffSigninAction } from "@/lib/auth/actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function StaffSigninForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    staffSigninAction,
    {},
  );

  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="code" value={code} />
      <Field label="Username" htmlFor="username">
        <Input
          id="username"
          name="username"
          autoCapitalize="none"
          autoComplete="username"
          placeholder="your username"
          required
        />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
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
