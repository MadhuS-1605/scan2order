"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  addTableAction,
  addTablesBulkAction,
  deleteTableAction,
  completeOnboardingAction,
  gotoStepAction,
} from "@/lib/onboarding/actions";
import { Button, Input, Field, Alert, Card, Select } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

type TableView = {
  id: string;
  label: string;
  seats: number;
  url: string;
  qr: string;
};

export function TablesStep({
  tables,
  serviceModel = "TABLE_SERVICE",
}: {
  tables: TableView[];
  serviceModel?: string;
}) {
  // Self-service venues have no tables — just one venue-wide ordering QR (the
  // auto-created "Counter"). Show it for printing and let them finish.
  if (serviceModel === "SELF_SERVICE") {
    const qr = tables[0];
    return (
      <div className="space-y-6">
        <Card>
          <h2 className="font-display text-2xl text-ink">Your ordering QR</h2>
          <p className="mt-1 text-sm text-ink/55">
            Print this and place it at your counter (or on a standee). Guests
            scan it, order, pay, and pick up by their order number — no tables.
          </p>
          {qr ? (
            <div className="mt-6 max-w-xs rounded-xl border border-sand-200 p-5 text-center">
              <Image
                src={qr.qr}
                alt="Venue ordering QR"
                width={200}
                height={200}
                unoptimized
                className="mx-auto h-48 w-48"
              />
              <p className="mt-3 text-xs break-all text-ink/45">{qr.url}</p>
              <a
                href={qr.qr}
                download="ordering-qr.png"
                className="mt-2 inline-block text-sm font-medium text-brand-600"
              >
                Download QR
              </a>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink/55">
              Generating your ordering QR… go back a step and continue.
            </p>
          )}
        </Card>

        <div className="flex items-center justify-between">
          <Button type="button" variant="secondary" onClick={() => gotoStepAction("settings")}>
            Back
          </Button>
          <form action={completeOnboardingAction}>
            <Button type="submit" size="lg" disabled={!qr}>
              Finish setup
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-2xl text-ink">Tables & QR codes</h2>
        <p className="mt-1 text-sm text-ink/55">
          Add each table. We generate a unique QR code diners scan to order.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <AddTableForm />
          <BulkTablesForm />
        </div>
      </Card>

      {tables.length > 0 && (
        <Card>
          <h3 className="font-semibold text-ink">
            Your tables ({tables.length})
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tables.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-sand-200 p-4 text-center"
              >
                <Image
                  src={t.qr}
                  alt={`QR for ${t.label}`}
                  width={160}
                  height={160}
                  unoptimized
                  className="mx-auto h-40 w-40"
                />
                <p className="mt-2 font-medium text-ink">{t.label}</p>
                <p className="text-xs text-ink/55">{t.seats} seats</p>
                <div className="mt-2 flex justify-center gap-3 text-xs">
                  <a
                    href={t.qr}
                    download={`qr-${t.label}.png`}
                    className="font-medium text-brand-600"
                  >
                    Download
                  </a>
                  <form action={deleteTableAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="text-red-600" type="submit">
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          onClick={() => gotoStepAction("settings")}
        >
          Back
        </Button>
        <form action={completeOnboardingAction}>
          <Button type="submit" size="lg" disabled={tables.length === 0}>
            Finish setup
          </Button>
        </form>
      </div>
    </div>
  );
}

function AddTableForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addTableAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Table label" htmlFor="t-label">
            <Input id="t-label" name="label" placeholder="T1" required />
          </Field>
        </div>
        <Field label="Seats" htmlFor="t-seats">
          <Input
            id="t-seats"
            name="seats"
            type="number"
            min="1"
            defaultValue="4"
            required
          />
        </Field>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add table"}
      </Button>
    </form>
  );
}

function BulkTablesForm() {
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
