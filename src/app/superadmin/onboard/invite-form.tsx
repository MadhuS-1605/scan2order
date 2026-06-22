"use client";

import { useActionState } from "react";
import { inviteOwnerAction } from "@/lib/platform/actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function InviteForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteOwnerAction, {});
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      <Field label="Owner name" htmlFor="name">
        <Input id="name" name="name" placeholder="Priya Sharma" required />
      </Field>
      <Field label="Owner email" htmlFor="email">
        <Input id="email" name="email" type="email" placeholder="owner@venue.com" required />
      </Field>
      <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create & invite"}</Button>
    </form>
  );
}
