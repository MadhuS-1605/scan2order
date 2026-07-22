"use client";

import { useActionState, useEffect, useRef } from "react";
import { useState } from "react";
import { addTableAction, addTablesBulkAction } from "@/lib/onboarding/actions";
import { Button, Input, Field, Select, Alert } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";
import type { ActionState } from "@/lib/validation";

export function AddTableForm() {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addTableAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState("TABLE");
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const isRoom = kind === "ROOM";

  return (
    <form ref={ref} action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <Field label={tr("tables.type")} htmlFor="t-kind">
        <Select
          id="t-kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="TABLE">{tr("tables.table")}</option>
          <option value="ROOM">{tr("tables.hotelRoom")}</option>
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={isRoom ? tr("tables.roomNumber") : tr("tables.label")} htmlFor="t-label">
            <Input
              id="t-label"
              name="label"
              placeholder={isRoom ? "204" : "T7"}
              required
            />
          </Field>
        </div>
        <Field label={tr("tables.seatsLabel")} htmlFor="t-seats">
          <Input
            id="t-seats"
            name="seats"
            type="number"
            min="1"
            defaultValue={isRoom ? "2" : "4"}
            required
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("tables.adding") : isRoom ? tr("tables.addRoom") : tr("tables.addTable")}
      </Button>
    </form>
  );
}

// Plain English (not routed through the i18n dict, unlike AddTableForm above)
// — the i18n system requires a real per-locale translation for every key, and
// mistranslating this isn't worth the risk for one admin-only form.
export function BulkAddTableForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addTablesBulkAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState("TABLE");
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const isRoom = kind === "ROOM";

  return (
    <form ref={ref} action={action} className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wide text-ink/45">
        Or generate a range at once
      </p>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
      <Field label="Type" htmlFor="bt-kind">
        <Select id="bt-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="TABLE">Table</option>
          <option value="ROOM">Hotel room</option>
        </Select>
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Prefix" htmlFor="bt-prefix">
          <Input id="bt-prefix" name="prefix" placeholder={isRoom ? "(none)" : "T"} defaultValue={isRoom ? "" : "T"} />
        </Field>
        <Field label="Start #" htmlFor="bt-start">
          <Input id="bt-start" name="startAt" type="number" min="1" defaultValue={isRoom ? "101" : "1"} required />
        </Field>
        <Field label="Count" htmlFor="bt-count">
          <Input id="bt-count" name="count" type="number" min="1" max="100" placeholder="20" required />
        </Field>
      </div>
      <Field label="Seats (each)" htmlFor="bt-seats">
        <Input id="bt-seats" name="seats" type="number" min="1" defaultValue={isRoom ? "2" : "4"} required />
      </Field>
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        {pending ? "Generating…" : isRoom ? "Generate rooms" : "Generate tables"}
      </Button>
    </form>
  );
}

export function PrintButton() {
  const tr = useT();
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      {tr("tables.printAllQr")}
    </Button>
  );
}
