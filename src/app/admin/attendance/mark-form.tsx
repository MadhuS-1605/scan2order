"use client";

import { useActionState, useEffect, useRef } from "react";
import { markAttendanceAction } from "@/lib/attendance/actions";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";
import type { ActionState } from "@/lib/validation";

type StaffOption = { id: string; name: string; role: string };

export function MarkAttendanceForm({ staff }: { staff: StaffOption[] }) {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    markAttendanceAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <h2 className="mb-1 font-semibold text-ink">{tr("attendance.recordAttendance")}</h2>
      <p className="mb-4 text-xs text-ink/45">
        {tr("attendance.recordHint")}
      </p>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.message}</Alert>}
        <Field label={tr("attendance.teamMember")} htmlFor="at-staff">
          <Select id="at-staff" name="adminUserId" required defaultValue="">
            <option value="" disabled>
              {tr("attendance.select")}
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={tr("attendance.clockIn")} htmlFor="at-in">
          <Input id="at-in" name="clockInAt" type="datetime-local" required />
        </Field>
        <Field label={tr("attendance.clockOutLabel")} htmlFor="at-out" hint={tr("attendance.clockOutHint")}>
          <Input id="at-out" name="clockOutAt" type="datetime-local" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? tr("common.saving") : tr("attendance.record")}
        </Button>
      </form>
    </Card>
  );
}
