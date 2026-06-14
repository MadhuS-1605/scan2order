"use client";

import { useActionState, useEffect, useState } from "react";
import { saveProfileAction } from "@/lib/onboarding/actions";
import { checkSubdomainAction } from "@/lib/tenant/actions";
import { normalizeSubdomain } from "@/lib/subdomain";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import type { ActionState } from "@/lib/validation";

const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";

type RestaurantLike = {
  name: string;
  type: string;
  subdomain: string | null;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
} | null;

export function ProfileStep({ restaurant }: { restaurant: RestaurantLike }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveProfileAction,
    {},
  );

  return (
    <Card>
      <h2 className="font-display text-2xl text-ink">Business profile</h2>
      <p className="mt-1 text-sm text-ink/55">
        Tell us about your restaurant, café or hotel.
      </p>
      <form action={action} className="mt-6 space-y-4">
        {state.error && <Alert>{state.error}</Alert>}
        <Field label="Business name" htmlFor="name">
          <Input
            id="name"
            name="name"
            defaultValue={restaurant?.name ?? ""}
            placeholder="Spice Garden"
            required
          />
        </Field>
        <Field label="Type" htmlFor="type">
          <Select
            id="type"
            name="type"
            defaultValue={restaurant?.type ?? "RESTAURANT"}
          >
            <option value="RESTAURANT">Restaurant</option>
            <option value="CAFE">Café</option>
            <option value="HOTEL">Hotel</option>
            <option value="CLOUD_KITCHEN">Cloud kitchen</option>
            <option value="BAR">Bar</option>
          </Select>
        </Field>
        <UsernameField defaultValue={restaurant?.subdomain ?? ""} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone">
            <Input
              id="phone"
              name="phone"
              defaultValue={restaurant?.phone ?? ""}
              placeholder="+91 98765 43210"
            />
          </Field>
          <Field label="Contact email" htmlFor="email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={restaurant?.email ?? ""}
              placeholder="hello@spicegarden.in"
            />
          </Field>
        </div>
        <Field label="Address" htmlFor="addressLine">
          <Input
            id="addressLine"
            name="addressLine"
            defaultValue={restaurant?.addressLine ?? ""}
            placeholder="12 MG Road"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue={restaurant?.city ?? ""} />
          </Field>
          <Field label="State" htmlFor="state">
            <Input
              id="state"
              name="state"
              defaultValue={restaurant?.state ?? ""}
            />
          </Field>
          <Field label="PIN code" htmlFor="postalCode">
            <Input
              id="postalCode"
              name="postalCode"
              defaultValue={restaurant?.postalCode ?? ""}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function UsernameField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<
    "idle" | "checking" | "ok" | "taken"
  >(defaultValue ? "ok" : "idle");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const v = normalizeSubdomain(value);
    if (v.length < 3) {
      setStatus("idle");
      setMsg(null);
      return;
    }
    setStatus("checking");
    const id = setTimeout(async () => {
      const res = await checkSubdomainAction(v);
      if (res.available) {
        setStatus("ok");
        setMsg(null);
      } else {
        setStatus("taken");
        setMsg(res.error ?? "Unavailable");
      }
    }, 400);
    return () => clearTimeout(id);
  }, [value]);

  return (
    <Field
      label="Choose your web address (username)"
      htmlFor="subdomain"
      hint={`Diners will visit ${value || "yourname"}.${PLATFORM_DOMAIN}`}
    >
      <div className="flex items-center gap-1">
        <Input
          id="subdomain"
          name="subdomain"
          value={value}
          onChange={(e) => setValue(normalizeSubdomain(e.target.value))}
          placeholder="spicegarden"
          required
        />
        <span className="whitespace-nowrap text-sm text-ink/45">
          .{PLATFORM_DOMAIN}
        </span>
      </div>
      {status === "checking" && (
        <p className="mt-1 text-xs text-ink/45">Checking availability…</p>
      )}
      {status === "ok" && value.length >= 3 && (
        <p className="mt-1 text-xs text-olive-600">✓ Available</p>
      )}
      {status === "taken" && (
        <p className="mt-1 text-xs text-red-600">{msg}</p>
      )}
    </Field>
  );
}
