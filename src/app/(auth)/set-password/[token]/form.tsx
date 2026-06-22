"use client";

import { useActionState } from "react";
import { setPasswordAction } from "@/lib/auth/actions";
import { Button, Field, Alert } from "@/components/ui";
import { PasswordInput } from "@/components/password-input";
import type { ActionState } from "@/lib/validation";

export function SetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setPasswordAction, {});
  return (
    <form action={action} className="space-y-4">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="New password" htmlFor="password">
        <PasswordInput id="password" name="password" placeholder="At least 8 characters" required minLength={8} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Setting…" : "Set password & continue"}
      </Button>
    </form>
  );
}
