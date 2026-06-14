"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPropertyAction } from "@/lib/properties/actions";
import { Card, Field, Input, Select, Button, Alert } from "@/components/ui";

export function AddPropertyForm() {
  const [state, action, pending] = useActionState(createPropertyAction, {});

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-brand-600" />
        <h2 className="font-medium text-ink">Add a property</h2>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        Spin up another outlet under your account. You&apos;ll switch to it to set
        up its menu, tables and QR codes.
      </p>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Property name" htmlFor="p-name">
            <Input
              id="p-name"
              name="name"
              placeholder="Spice Garden — Koramangala"
              required
            />
          </Field>
        </div>
        <Field label="Type" htmlFor="p-type">
          <Select id="p-type" name="type" defaultValue="RESTAURANT">
            <option value="RESTAURANT">Restaurant</option>
            <option value="CAFE">Café</option>
            <option value="HOTEL">Hotel</option>
            <option value="CLOUD_KITCHEN">Cloud kitchen</option>
            <option value="BAR">Bar</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="City (optional)" htmlFor="p-city">
            <Input id="p-city" name="city" placeholder="Bengaluru" />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create & switch"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
