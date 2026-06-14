"use client";

import { useState } from "react";
import { PartyPopper, CheckCircle2 } from "lucide-react";
import { createBanquetEnquiryAction } from "@/lib/banquets/actions";
import { Button, Input, Select, Textarea, Field, Alert } from "@/components/ui";

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Corporate",
  "Anniversary",
  "Get-together",
  "Other",
];

export function BanquetEnquiryForm({
  slug,
  restaurantName,
}: {
  slug: string;
  restaurantName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    eventType: "Wedding",
    eventDate: "",
    guestCount: "100",
    notes: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createBanquetEnquiryAction({
        slug,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        eventType: form.eventType,
        eventDate: form.eventDate,
        guestCount: Number(form.guestCount) || 1,
        notes: form.notes || undefined,
      });
      if (res.ok) setDone(true);
      else setError(res.error ?? "Could not send your enquiry.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-olive-500/30 bg-olive-500/10 p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-olive-600" />
        <p className="mt-3 font-medium text-ink">Enquiry sent!</p>
        <p className="mt-1 text-sm text-ink/60">
          {restaurantName} will reach out on {form.customerPhone || "your number"}{" "}
          with a menu and quote.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-sand-200 bg-surface p-5">
      {error && <Alert>{error}</Alert>}
      <Field label="Your name" htmlFor="e-name">
        <Input
          id="e-name"
          value={form.customerName}
          onChange={(e) => set("customerName", e.target.value)}
          placeholder="Asha Rao"
        />
      </Field>
      <Field label="Mobile number" htmlFor="e-phone">
        <Input
          id="e-phone"
          inputMode="tel"
          value={form.customerPhone}
          onChange={(e) => set("customerPhone", e.target.value)}
          placeholder="+91 98765 43210"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Event type" htmlFor="e-type">
          <Select
            id="e-type"
            value={form.eventType}
            onChange={(e) => set("eventType", e.target.value)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Guests" htmlFor="e-guests">
          <Input
            id="e-guests"
            type="number"
            min="1"
            value={form.guestCount}
            onChange={(e) => set("guestCount", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Event date & time" htmlFor="e-date">
        <Input
          id="e-date"
          type="datetime-local"
          value={form.eventDate}
          onChange={(e) => set("eventDate", e.target.value)}
        />
      </Field>
      <Field label="Anything else?" htmlFor="e-notes">
        <Textarea
          id="e-notes"
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Veg only, stage, decor, budget…"
        />
      </Field>
      <Button
        className="w-full"
        onClick={submit}
        disabled={busy || form.customerName.length < 2 || !form.eventDate}
      >
        <PartyPopper className="h-4 w-4" />
        {busy ? "Sending…" : "Send enquiry"}
      </Button>
    </div>
  );
}
