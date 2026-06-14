"use client";

import { useActionState, useEffect, useRef } from "react";
import { useState } from "react";
import { addTableAction } from "@/lib/onboarding/actions";
import { Button, Input, Field, Select, Alert } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

export function AddTableForm() {
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
      <Field label="Type" htmlFor="t-kind">
        <Select
          id="t-kind"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="TABLE">Table</option>
          <option value="ROOM">Hotel room</option>
        </Select>
      </Field>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={isRoom ? "Room number" : "Label"} htmlFor="t-label">
            <Input
              id="t-label"
              name="label"
              placeholder={isRoom ? "204" : "T7"}
              required
            />
          </Field>
        </div>
        <Field label="Seats" htmlFor="t-seats">
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
        {pending ? "Adding…" : isRoom ? "Add room" : "Add table"}
      </Button>
    </form>
  );
}

export function PrintButton() {
  return (
    <Button variant="secondary" size="sm" onClick={() => window.print()}>
      Print all QR codes
    </Button>
  );
}
