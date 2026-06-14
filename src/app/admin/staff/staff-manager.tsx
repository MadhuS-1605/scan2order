"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  createStaffAction,
  updateStaffRoleAction,
  deleteStaffAction,
  resetStaffPasswordAction,
  setStaffDisabledAction,
} from "@/lib/staff/actions";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import { ROLE_LABELS, ASSIGNABLE_ROLES } from "@/lib/auth/permissions";
import type { ActionState } from "@/lib/validation";

type Staff = {
  id: string;
  name: string;
  username: string | null;
  role: string;
  disabled: boolean;
};

const ROLE_HINT: Record<string, string> = {
  MANAGER: "Everything except staff",
  CASHIER: "Orders & billing",
  WAITER: "Take & confirm orders",
  KITCHEN: "Kitchen screen only",
};

export function StaffManager({
  currentUserId,
  staff,
}: {
  currentUserId: string;
  staff: Staff[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddStaffForm />

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Team ({staff.length})</h2>
        <ul className="divide-y divide-sand-100">
          {staff.map((s) => {
            const isOwner = s.role === "OWNER";
            const isSelf = s.id === currentUserId;
            return (
              <li key={s.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {s.name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs text-ink/40">(you)</span>
                      )}
                      {s.disabled && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                          Disabled
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {isOwner
                        ? "Owner · email login"
                        : s.username
                          ? `@${s.username}`
                          : "no username"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
                        Owner
                      </span>
                    ) : (
                      <>
                        <form action={updateStaffRoleAction}>
                          <input type="hidden" name="id" value={s.id} />
                          <Select
                            name="role"
                            defaultValue={s.role}
                            disabled={isSelf}
                            onChange={(e) => e.currentTarget.form?.requestSubmit()}
                            className="w-36"
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ))}
                          </Select>
                        </form>
                        {!isSelf && (
                          <form action={setStaffDisabledAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <input
                              type="hidden"
                              name="disabled"
                              value={(!s.disabled).toString()}
                            />
                            <Button size="sm" variant="ghost" type="submit">
                              {s.disabled ? "Enable" : "Disable"}
                            </Button>
                          </form>
                        )}
                        {!isSelf && (
                          <form action={deleteStaffAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button size="sm" variant="ghost" type="submit">
                              Remove
                            </Button>
                          </form>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!isOwner && !isSelf && <ResetPasswordRow id={s.id} />}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function ResetPasswordRow({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resetStaffPasswordAction,
    {},
  );
  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-ink/45 hover:text-brand-600"
      >
        Reset password
      </button>
    );
  }
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <Alert>{state.error}</Alert>}
      <Input
        name="password"
        type="text"
        minLength={8}
        placeholder="New password (min 8)"
        required
        className="h-9 text-sm"
      />
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}

function AddStaffForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createStaffAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <h2 className="mb-4 font-semibold text-ink">Add a team member</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.message}</Alert>}
        <Field label="Name" htmlFor="st-name">
          <Input id="st-name" name="name" placeholder="Asha Kumar" required />
        </Field>
        <Field
          label="Username"
          htmlFor="st-username"
          hint="They sign in with this at your restaurant link"
        >
          <Input
            id="st-username"
            name="username"
            autoCapitalize="none"
            placeholder="asha"
            required
          />
        </Field>
        <Field label="Temporary password" htmlFor="st-pass" hint="Min 8 chars">
          <Input
            id="st-pass"
            name="password"
            type="text"
            placeholder="they can change it later"
            required
          />
        </Field>
        <Field label="Role" htmlFor="st-role">
          <Select id="st-role" name="role" defaultValue="WAITER">
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} — {ROLE_HINT[r]}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Adding…" : "Add member"}
        </Button>
      </form>
    </Card>
  );
}
