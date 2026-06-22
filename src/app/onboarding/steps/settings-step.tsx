"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveSettingsAction,
  gotoStepAction,
  verifyGstinAction,
} from "@/lib/onboarding/actions";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

type Config = {
  orderConfirmation: string;
  paymentTiming: string;
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  gstMode: string;
  gstNumber: string | null;
  gstLegalName: string | null;
  gstVerified: boolean;
  gstPercentage: string | number;
  serviceModel?: string;
};

export function SettingsStep({ config }: { config: Config }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveSettingsAction,
    {},
  );
  const [gstMode, setGstMode] = useState(config.gstMode);
  const [gstNumber, setGstNumber] = useState(config.gstNumber ?? "");
  // The verified business name (from the GSTN) drives what we submit + show.
  // Seeded from saved state so a previously-verified GSTIN stays confirmed.
  const [verified, setVerified] = useState<string | null>(
    config.gstVerified ? config.gstLegalName : null,
  );
  const [gstNote, setGstNote] = useState<string | null>(null);
  const [gstError, setGstError] = useState<string | null>(null);
  const [verifying, startVerify] = useTransition();

  function onGstinChange(value: string) {
    // Editing the number invalidates any prior verification.
    setGstNumber(value.toUpperCase());
    setVerified(null);
    setGstNote(null);
    setGstError(null);
  }

  function handleVerify() {
    setGstError(null);
    setGstNote(null);
    startVerify(async () => {
      const r = await verifyGstinAction(gstNumber);
      if (r.ok) {
        setVerified(r.legalName);
        // Surface a non-blocking warning for non-active registrations.
        if (r.status.toLowerCase() !== "active") {
          setGstNote(`Heads up: this GSTIN's status is "${r.status}".`);
        }
      } else {
        setVerified(null);
        setGstError(r.error);
      }
    });
  }

  const gstOff = gstMode === "NONE";

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink">Operations & payments</h2>
      <p className="mt-1 text-sm text-ink/55">
        How orders are confirmed, how customers pay, and tax handling.
      </p>

      <form action={action} className="mt-6 space-y-6">
        {state.error && <Alert>{state.error}</Alert>}

        <fieldset>
          <legend className="text-sm font-medium text-ink/80">
            Order confirmation
          </legend>
          <p className="mb-2 text-xs text-ink/55">
            Should a waiter confirm orders before they reach the kitchen?
          </p>
          <div className="space-y-2">
            <RadioCard
              name="orderConfirmation"
              value="AUTO"
              defaultChecked={config.orderConfirmation === "AUTO"}
              title="Auto-confirm"
              desc="Orders go straight to the kitchen (good for small cafés)."
            />
            <RadioCard
              name="orderConfirmation"
              value="WAITER_CONFIRM"
              defaultChecked={config.orderConfirmation === "WAITER_CONFIRM"}
              title="Waiter confirms"
              desc="A waiter approves each order before the kitchen sees it."
            />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-ink/80">
            When do customers pay?
          </legend>
          {config.serviceModel === "SELF_SERVICE" ? (
            <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm text-ink/70">
              <input type="hidden" name="paymentTiming" value="PAY_BEFORE" />
              <span className="font-medium text-ink">Pay first (self-service)</span>
              <p className="mt-0.5 text-xs text-ink/55">
                Guests pay when they order; the order is sent to the kitchen only
                after payment is received, then they pick up by number. Choose
                which payment methods to accept below.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2">
              <RadioCard
                name="paymentTiming"
                value="PAY_AFTER"
                defaultChecked={config.paymentTiming === "PAY_AFTER"}
                title="Pay after (request bill at the end)"
                desc="Diners eat first, then request the bill (cafés, dine-in)."
              />
              <RadioCard
                name="paymentTiming"
                value="PAY_BEFORE"
                defaultChecked={config.paymentTiming === "PAY_BEFORE"}
                title="Pay before (pay when ordering)"
                desc="Payment is collected at order time (hotels, QSR)."
              />
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-ink/80">
            Payment methods
          </legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="onlinePaymentEnabled"
                defaultChecked={config.onlinePaymentEnabled}
              />
              Online payment (Razorpay)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="counterPaymentEnabled"
                defaultChecked={config.counterPaymentEnabled}
              />
              Pay at counter
            </label>
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink/80">
            GST / tax
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GST mode" htmlFor="gstMode">
              <Select
                id="gstMode"
                name="gstMode"
                value={gstMode}
                onChange={(e) => setGstMode(e.target.value)}
              >
                <option value="NONE">No GST</option>
                <option value="EXCLUSIVE">Added on top (exclusive)</option>
                <option value="INCLUSIVE">Included in price (inclusive)</option>
              </Select>
            </Field>
            <Field label="GST %" htmlFor="gstPercentage">
              <Input
                id="gstPercentage"
                name="gstPercentage"
                type="number"
                step="0.01"
                min="0"
                max="28"
                defaultValue={String(config.gstPercentage)}
                disabled={gstOff}
              />
            </Field>
          </div>

          {/* GSTIN — verified against the GSTN; we fetch the registered legal
              name rather than asking the owner to type it. */}
          <Field
            label="GSTIN"
            htmlFor="gstNumber"
            hint="We'll verify this and fetch your registered business name."
          >
            <div className="flex gap-2">
              <Input
                id="gstNumber"
                name="gstNumber"
                value={gstNumber}
                onChange={(e) => onGstinChange(e.target.value)}
                placeholder="29ABCDE1234F1Z5"
                maxLength={15}
                autoCapitalize="characters"
                spellCheck={false}
                className="font-mono uppercase"
                disabled={gstOff}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleVerify}
                disabled={gstOff || verifying || gstNumber.length !== 15}
              >
                {verifying ? "Verifying…" : "Verify"}
              </Button>
            </div>
          </Field>

          {/* Carries the verification outcome into the form submit. */}
          <input type="hidden" name="gstLegalName" value={verified ?? ""} />
          <input
            type="hidden"
            name="gstVerified"
            value={verified ? "true" : "false"}
          />

          {!gstOff && verified && (
            <Alert variant="success">
              Verified — <span className="font-medium">{verified}</span>
            </Alert>
          )}
          {!gstOff && gstNote && <Alert variant="info">{gstNote}</Alert>}
          {!gstOff && gstError && <Alert>{gstError}</Alert>}
        </fieldset>

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => gotoStepAction("menu")}
          >
            Back
          </Button>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RadioCard({
  name,
  value,
  defaultChecked,
  title,
  desc,
}: {
  name: string;
  value: string;
  defaultChecked: boolean;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-sand-200 p-3 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-1"
      />
      <span>
        <span className="block text-sm font-medium text-ink">
          {title}
        </span>
        <span className="block text-xs text-ink/55">{desc}</span>
      </span>
    </label>
  );
}
