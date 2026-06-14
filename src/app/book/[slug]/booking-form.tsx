"use client";

import { useState } from "react";
import { CalendarCheck, Clock, CheckCircle2 } from "lucide-react";
import { createReservationAction } from "@/lib/reservations/actions";
import { Button, Input, Textarea, Field, Alert } from "@/components/ui";

export function BookingForm({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const [type, setType] = useState<"RESERVATION" | "WAITLIST">("RESERVATION");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [party, setParty] = useState(2);
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [mocked, setMocked] = useState(false);

  async function submit() {
    setErr(null);
    setBusy(true);
    try {
      const res = await createReservationAction({
        slug,
        type,
        customerName: name,
        customerPhone: phone,
        partySize: party,
        reservedFor: type === "RESERVATION" ? when : undefined,
        notes: notes || undefined,
      });
      if (!res.ok) return setErr(res.error ?? "Something went wrong.");
      setMocked(Boolean(res.mocked));
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-surface p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-olive-600" />
        <p className="mt-2 font-display text-xl text-ink">Request received!</p>
        <p className="mt-1 text-sm text-ink/55">
          {restaurantName} will confirm your table shortly
          {mocked ? " (WhatsApp is in test mode)." : " on WhatsApp."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-surface p-5">
      <div className="mb-4 grid grid-cols-2 gap-2">
        <TabButton
          active={type === "RESERVATION"}
          onClick={() => setType("RESERVATION")}
          icon={CalendarCheck}
          label="Book ahead"
        />
        <TabButton
          active={type === "WAITLIST"}
          onClick={() => setType("WAITLIST")}
          icon={Clock}
          label="Join waitlist"
        />
      </div>

      <div className="space-y-3">
        {err && <Alert>{err}</Alert>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" htmlFor="b-name">
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </Field>
          <Field label="Party size" htmlFor="b-party">
            <Input
              id="b-party"
              type="number"
              min="1"
              max="50"
              value={party}
              onChange={(e) => setParty(Number(e.target.value))}
            />
          </Field>
        </div>
        <Field label="Mobile (WhatsApp)" htmlFor="b-phone">
          <Input
            id="b-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+9198…"
            inputMode="tel"
          />
        </Field>
        {type === "RESERVATION" && (
          <Field label="Date & time" htmlFor="b-when">
            <Input
              id="b-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </Field>
        )}
        <Field label="Notes" htmlFor="b-notes" hint="Optional">
          <Textarea
            id="b-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="High chair, window seat, allergies…"
          />
        </Field>
        <Button
          size="lg"
          className="w-full"
          onClick={submit}
          disabled={
            busy ||
            name.length < 2 ||
            phone.length < 8 ||
            (type === "RESERVATION" && !when)
          }
        >
          {busy
            ? "Sending…"
            : type === "WAITLIST"
              ? "Join the waitlist"
              : "Request reservation"}
        </Button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CalendarCheck;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-sand-300 text-ink/60 hover:bg-sand-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
