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
import { useT } from "@/components/admin/i18n-provider";
import type { ActionState } from "@/lib/validation";

type Staff = {
  id: string;
  name: string;
  username: string | null;
  role: string;
  disabled: boolean;
};

const ROLE_HINT_KEY: Record<string, string> = {
  MANAGER: "staff.roleHintManager",
  CASHIER: "staff.roleHintCashier",
  WAITER: "staff.roleHintWaiter",
  KITCHEN: "staff.roleHintKitchen",
};

export function StaffManager({
  currentUserId,
  staff,
}: {
  currentUserId: string;
  staff: Staff[];
}) {
  const tr = useT();
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddStaffForm />

      <Card>
        <h2 className="mb-3 font-semibold text-ink">{`${tr("staff.team")} (${staff.length})`}</h2>
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
                        <span className="ml-1.5 text-xs text-ink/40">{`(${tr("staff.you")})`}</span>
                      )}
                      {s.disabled && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-700">
                          {tr("common.disabled")}
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink/50">
                      {isOwner
                        ? tr("staff.ownerEmailLogin")
                        : s.username
                          ? `@${s.username}`
                          : tr("staff.noUsername")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner ? (
                      <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700">
                        {tr("staff.owner")}
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
                              {s.disabled ? tr("staff.enable") : tr("staff.disable")}
                            </Button>
                          </form>
                        )}
                        {!isSelf && (
                          <form action={deleteStaffAction}>
                            <input type="hidden" name="id" value={s.id} />
                            <Button size="sm" variant="ghost" type="submit">
                              {tr("common.remove")}
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
  const tr = useT();
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
        {tr("staff.resetPassword")}
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
        placeholder={tr("staff.newPasswordPlaceholder")}
        required
        className="h-9 text-sm"
      />
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? tr("common.saving") : tr("common.save")}
      </Button>
      <Button size="sm" variant="ghost" type="button" onClick={() => setOpen(false)}>
        {tr("common.cancel")}
      </Button>
    </form>
  );
}

function AddStaffForm() {
  const tr = useT();
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
      <h2 className="mb-4 font-semibold text-ink">{tr("staff.addMember")}</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.message}</Alert>}
        <Field label={tr("common.name")} htmlFor="st-name">
          <Input id="st-name" name="name" placeholder="Asha Kumar" required />
        </Field>
        <Field
          label={tr("staff.username")}
          htmlFor="st-username"
          hint={tr("staff.usernameHint")}
        >
          <Input
            id="st-username"
            name="username"
            autoCapitalize="none"
            placeholder="asha"
            required
          />
        </Field>
        <Field label={tr("staff.temporaryPassword")} htmlFor="st-pass" hint={tr("staff.min8Chars")}>
          <Input
            id="st-pass"
            name="password"
            type="text"
            placeholder={tr("staff.changeLaterPlaceholder")}
            required
          />
        </Field>
        <Field label={tr("staff.role")} htmlFor="st-role">
          <Select id="st-role" name="role" defaultValue="WAITER">
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]} — {tr(ROLE_HINT_KEY[r])}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? tr("staff.adding") : tr("staff.addMemberButton")}
        </Button>
      </form>
    </Card>
  );
}
