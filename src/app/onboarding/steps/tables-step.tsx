"use client";

import { useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  addTableAction,
  deleteTableAction,
  completeOnboardingAction,
  gotoStepAction,
} from "@/lib/onboarding/actions";
import { Button, Input, Field, Alert, Card } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

type TableView = {
  id: string;
  label: string;
  seats: number;
  url: string;
  qr: string;
};

export function TablesStep({ tables }: { tables: TableView[] }) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-2xl text-ink">Tables & QR codes</h2>
        <p className="mt-1 text-sm text-ink/55">
          Add each table. We generate a unique QR code diners scan to order.
        </p>
        <div className="mt-6 max-w-sm">
          <AddTableForm />
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
