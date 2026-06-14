"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  createBanquetAction,
  addBanquetItemAction,
} from "@/lib/banquets/actions";
import { Button, Input, Select, Field } from "@/components/ui";

const EVENT_TYPES = [
  "Wedding",
  "Birthday",
  "Corporate",
  "Anniversary",
  "Get-together",
  "Other",
];

export function NewBanquetForm() {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await createBanquetAction(fd);
        ref.current?.reset();
      }}
      className="grid gap-3 sm:grid-cols-2"
    >
      <Field label="Customer name" htmlFor="b-name">
        <Input id="b-name" name="customerName" required placeholder="Asha Rao" />
      </Field>
      <Field label="Mobile" htmlFor="b-phone">
        <Input id="b-phone" name="customerPhone" inputMode="tel" placeholder="98765 43210" />
      </Field>
      <Field label="Event type" htmlFor="b-type">
        <Select id="b-type" name="eventType" defaultValue="Wedding">
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date & time" htmlFor="b-date">
        <Input id="b-date" name="eventDate" type="datetime-local" required />
      </Field>
      <Field label="Guests" htmlFor="b-guests">
        <Input id="b-guests" name="guestCount" type="number" min="1" defaultValue="50" />
      </Field>
      <Field label="Hall / space" htmlFor="b-hall">
        <Input id="b-hall" name="hall" placeholder="Banquet Hall A" />
      </Field>
      <Field label="Advance collected" htmlFor="b-advance">
        <Input id="b-advance" name="advanceAmount" type="number" min="0" step="0.01" defaultValue="0" />
      </Field>
      <Field label="Notes" htmlFor="b-notes">
        <Input id="b-notes" name="notes" placeholder="Veg only, stage setup…" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full">
          Create booking
        </Button>
      </div>
    </form>
  );
}

export function AddPreorderItem({
  bookingId,
  menu,
}: {
  bookingId: string;
  menu: { id: string; name: string; price: number }[];
}) {
  const [itemId, setItemId] = useState(menu[0]?.id ?? "");
  const [qty, setQty] = useState("10");
  if (menu.length === 0)
    return <p className="text-xs text-ink/40">Add menu items first.</p>;

  return (
    <form action={addBanquetItemAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <select
        name="menuItemId"
        value={itemId}
        onChange={(e) => setItemId(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-sand-300 bg-surface px-2 py-1.5 text-sm"
      >
        {menu.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · ₹{m.price}
          </option>
        ))}
      </select>
      <input
        name="quantity"
        type="number"
        min="1"
        value={qty}
        onChange={(e) => setQty(e.target.value)}
        className="w-20 rounded-lg border border-sand-300 bg-surface px-2 py-1.5 text-sm"
      />
      <Button type="submit" variant="secondary" size="sm">
        <Plus className="h-3.5 w-3.5" /> Add
      </Button>
    </form>
  );
}
