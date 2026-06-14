"use client";

import { useActionState, useState } from "react";
import {
  updateProfileAction,
  updateOperationsAction,
  updatePaymentCredsAction,
} from "@/lib/settings/actions";
import {
  Button,
  Input,
  Select,
  Field,
  Alert,
  Card,
} from "@/components/ui";
import type { ActionState } from "@/lib/validation";
import { LANGUAGES } from "@/lib/languages";
import { updateTenantAction } from "@/lib/tenant/actions";

type Profile = {
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
};

type Config = {
  orderConfirmation: string;
  paymentTiming: string;
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  gstMode: string;
  gstNumber: string | null;
  gstPercentage: string;
  reviewUrl: string | null;
  happyHourEnabled: boolean;
  happyHourFrom: string | null;
  happyHourTo: string | null;
  happyHourPercent: string;
  languages: string;
  kotPrinterHost: string | null;
  kotPrinterPort: number;
  featureReservations: boolean;
  featureRooms: boolean;
  featureBanquets: boolean;
  featureBar: boolean;
  featureAttendance: boolean;
  requireDinerLocation: boolean;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  orderRadiusM: number;
  razorpayKeyId: string | null;
  hasRazorpaySecret: boolean;
  whatsappFrom: string | null;
  upiId: string | null;
  upiName: string | null;
};

function Status({ state }: { state: ActionState }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok)
    return <Alert variant="success">{state.message ?? "Saved"}</Alert>;
  return null;
}

export function SettingsForms({
  tenant,
  profile,
  config,
}: {
  tenant: { subdomain: string | null; customDomain: string | null };
  profile: Profile;
  config: Config;
}) {
  return (
    <div className="space-y-6">
      <TenantForm tenant={tenant} />
      <ProfileForm profile={profile} />
      <OperationsForm config={config} />
      <PaymentForm config={config} />
    </div>
  );
}

function TenantForm({
  tenant,
}: {
  tenant: { subdomain: string | null; customDomain: string | null };
}) {
  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";
  return (
    <Card>
      <h2 className="font-semibold text-ink">Web address</h2>
      <p className="mt-1 text-sm text-ink/55">
        Your public link diners scan to. Use your free subdomain or connect your
        own domain.
      </p>
      <form action={updateTenantAction} className="mt-4 space-y-4">
        <Field label="Username (subdomain)" htmlFor="t-sub">
          <div className="flex items-center gap-1">
            <Input
              id="t-sub"
              name="subdomain"
              defaultValue={tenant.subdomain ?? ""}
              placeholder="spicegarden"
            />
            <span className="whitespace-nowrap text-sm text-ink/45">
              .{platformDomain}
            </span>
          </div>
        </Field>
        <Field
          label="Custom domain"
          htmlFor="t-domain"
          hint="Point a CNAME to the platform, then enter it here."
        >
          <Input
            id="t-domain"
            name="customDomain"
            defaultValue={tenant.customDomain ?? ""}
            placeholder="order.yourrestaurant.com"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit">Save web address</Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    {},
  );
  return (
    <Card>
      <h2 className="font-semibold text-ink">Business profile</h2>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="s-name">
            <Input id="s-name" name="name" defaultValue={profile.name} required />
          </Field>
          <Field label="Type" htmlFor="s-type">
            <Select id="s-type" name="type" defaultValue={profile.type}>
              <option value="RESTAURANT">Restaurant</option>
              <option value="CAFE">Café</option>
              <option value="HOTEL">Hotel</option>
              <option value="CLOUD_KITCHEN">Cloud kitchen</option>
              <option value="BAR">Bar</option>
            </Select>
          </Field>
          <Field label="Phone" htmlFor="s-phone">
            <Input id="s-phone" name="phone" defaultValue={profile.phone ?? ""} />
          </Field>
          <Field label="Email" htmlFor="s-email">
            <Input
              id="s-email"
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
            />
          </Field>
        </div>
        <Field label="Address" htmlFor="s-addr">
          <Input
            id="s-addr"
            name="addressLine"
            defaultValue={profile.addressLine ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="City" htmlFor="s-city">
            <Input id="s-city" name="city" defaultValue={profile.city ?? ""} />
          </Field>
          <Field label="State" htmlFor="s-state">
            <Input id="s-state" name="state" defaultValue={profile.state ?? ""} />
          </Field>
          <Field label="PIN" htmlFor="s-pin">
            <Input
              id="s-pin"
              name="postalCode"
              defaultValue={profile.postalCode ?? ""}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OperationsForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateOperationsAction,
    {},
  );
  const [gstMode, setGstMode] = useState(config.gstMode);
  return (
    <Card>
      <h2 className="font-semibold text-ink">Operations, payments &amp; tax</h2>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order confirmation" htmlFor="o-confirm">
            <Select
              id="o-confirm"
              name="orderConfirmation"
              defaultValue={config.orderConfirmation}
            >
              <option value="AUTO">Auto-confirm (straight to kitchen)</option>
              <option value="WAITER_CONFIRM">Waiter confirms first</option>
            </Select>
          </Field>
          <Field label="Payment timing" htmlFor="o-timing">
            <Select
              id="o-timing"
              name="paymentTiming"
              defaultValue={config.paymentTiming}
            >
              <option value="PAY_AFTER">Pay after (request bill at end)</option>
              <option value="PAY_BEFORE">Pay before (at order time)</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
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
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="GST mode" htmlFor="o-gst">
            <Select
              id="o-gst"
              name="gstMode"
              value={gstMode}
              onChange={(e) => setGstMode(e.target.value)}
            >
              <option value="NONE">No GST</option>
              <option value="EXCLUSIVE">Exclusive (added on top)</option>
              <option value="INCLUSIVE">Inclusive (in price)</option>
            </Select>
          </Field>
          <Field label="GST %" htmlFor="o-pct">
            <Input
              id="o-pct"
              name="gstPercentage"
              type="number"
              step="0.01"
              defaultValue={config.gstPercentage}
              disabled={gstMode === "NONE"}
            />
          </Field>
          <Field label="GSTIN" htmlFor="o-num">
            <Input
              id="o-num"
              name="gstNumber"
              defaultValue={config.gstNumber ?? ""}
              disabled={gstMode === "NONE"}
            />
          </Field>
        </div>
        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            Menu languages
          </legend>
          <p className="mb-2 text-xs text-ink/45">
            English is always available. Pick extra languages diners can switch
            to (add translations per item in the Menu editor).
          </p>
          <div className="flex flex-wrap gap-3">
            {LANGUAGES.filter((l) => l.code !== "en").map((l) => (
              <label
                key={l.code}
                className="flex items-center gap-1.5 text-sm text-ink/75"
              >
                <input
                  type="checkbox"
                  name="languages"
                  value={l.code}
                  defaultChecked={config.languages
                    .split(",")
                    .includes(l.code)}
                />
                {l.native}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            Happy hour
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="happyHourEnabled"
              defaultChecked={config.happyHourEnabled}
            />
            Enable an automatic discount during a daily window
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label="From" htmlFor="hh-from">
              <Input
                id="hh-from"
                name="happyHourFrom"
                type="time"
                defaultValue={config.happyHourFrom ?? ""}
              />
            </Field>
            <Field label="To" htmlFor="hh-to">
              <Input
                id="hh-to"
                name="happyHourTo"
                type="time"
                defaultValue={config.happyHourTo ?? ""}
              />
            </Field>
            <Field label="% off" htmlFor="hh-pct">
              <Input
                id="hh-pct"
                name="happyHourPercent"
                type="number"
                min="0"
                max="90"
                defaultValue={config.happyHourPercent}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            Kitchen printer
          </legend>
          <p className="mb-3 text-xs text-ink/50">
            Optional. Add a network thermal printer (ESC/POS) to send tickets
            straight from the kitchen screen. Leave blank to print via the
            browser. Find the printer&apos;s IP in its self-test page.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label="Printer IP address" htmlFor="kot-host">
                <Input
                  id="kot-host"
                  name="kotPrinterHost"
                  placeholder="192.168.1.50"
                  defaultValue={config.kotPrinterHost ?? ""}
                />
              </Field>
            </div>
            <Field label="Port" htmlFor="kot-port">
              <Input
                id="kot-port"
                name="kotPrinterPort"
                type="number"
                min="1"
                max="65535"
                defaultValue={config.kotPrinterPort}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            Modules
          </legend>
          <p className="mb-3 text-xs text-ink/50">
            Turn on only what this venue uses — the rest stay hidden from the
            dashboard.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: "featureReservations", label: "Reservations & waitlist", on: config.featureReservations },
              { name: "featureRooms", label: "Hotel rooms (in-room dining)", on: config.featureRooms },
              { name: "featureBanquets", label: "Banquets & events", on: config.featureBanquets },
              { name: "featureBar", label: "Bar counter", on: config.featureBar },
              { name: "featureAttendance", label: "Staff attendance (clock-in/out)", on: config.featureAttendance },
              { name: "requireDinerLocation", label: "Require diners at the venue to order", on: config.requireDinerLocation },
            ].map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-sm text-ink/80">
                <input type="checkbox" name={f.name} defaultChecked={f.on} />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>

        <VenueLocation
          latitude={config.latitude}
          longitude={config.longitude}
          geofenceRadiusM={config.geofenceRadiusM}
          orderRadiusM={config.orderRadiusM}
          requireDinerLocation={config.requireDinerLocation}
        />

        <Field
          label="Review link (Google Maps, etc.)"
          htmlFor="o-review"
          hint="Diners who rate 4★+ are nudged to review here"
        >
          <Input
            id="o-review"
            name="reviewUrl"
            type="url"
            placeholder="https://g.page/r/…"
            defaultValue={config.reviewUrl ?? ""}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updatePaymentCredsAction,
    {},
  );
  return (
    <Card>
      <h2 className="font-semibold text-ink">
        Payment &amp; messaging credentials
      </h2>
      <p className="mt-1 text-sm text-ink/55">
        Optional per-restaurant keys. Leave blank to use the platform defaults
        from environment variables.
      </p>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razorpay Key ID" htmlFor="r-id">
            <Input
              id="r-id"
              name="razorpayKeyId"
              defaultValue={config.razorpayKeyId ?? ""}
              placeholder="rzp_live_xxx"
            />
          </Field>
          <Field
            label="Razorpay Key Secret"
            htmlFor="r-secret"
            hint={
              config.hasRazorpaySecret
                ? "A secret is saved. Leave blank to keep it."
                : undefined
            }
          >
            <Input
              id="r-secret"
              name="razorpayKeySecret"
              type="password"
              placeholder={config.hasRazorpaySecret ? "••••••••" : ""}
            />
          </Field>
        </div>
        <Field
          label="WhatsApp sender"
          htmlFor="w-from"
          hint="e.g. whatsapp:+14155238886"
        >
          <Input
            id="w-from"
            name="whatsappFrom"
            defaultValue={config.whatsappFrom ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="UPI ID (for scan-to-pay)"
            htmlFor="upi-id"
            hint="Bill QR pays this UPI ID directly"
          >
            <Input
              id="upi-id"
              name="upiId"
              defaultValue={config.upiId ?? ""}
              placeholder="yourcafe@oksbi"
            />
          </Field>
          <Field label="UPI payee name" htmlFor="upi-name">
            <Input
              id="upi-name"
              name="upiName"
              defaultValue={config.upiName ?? ""}
              placeholder="Your Café"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save credentials"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

// Venue geofence for staff attendance — captured from a device at the restaurant.
function VenueLocation({
  latitude,
  longitude,
  geofenceRadiusM,
  orderRadiusM,
  requireDinerLocation,
}: {
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  orderRadiusM: number;
  requireDinerLocation: boolean;
}) {
  const [lat, setLat] = useState<number | null>(latitude);
  const [lng, setLng] = useState<number | null>(longitude);
  const [status, setStatus] = useState<string | null>(null);
  const missing = requireDinerLocation && lat == null && lng == null;

  function capture() {
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation isn't available on this device.");
      return;
    }
    setStatus("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setStatus("Location captured — save settings to apply.");
      },
      () => setStatus("Couldn't get location. Allow access and try again."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <fieldset className="rounded-lg border border-sand-200 p-3">
      <legend className="px-1 text-sm font-medium text-ink/70">
        Venue location (attendance &amp; ordering)
      </legend>
      <p className="mb-3 text-xs text-ink/50">
        Set this from a device at the restaurant. Used to verify staff clock-in/out
        and (if enabled above) that diners are on-site when they order.
      </p>
      {missing && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠ &ldquo;Require diners at the venue&rdquo; is on but no location is set, so
          diners can&apos;t be verified — orders will go through unverified until you
          capture the venue location below.
        </p>
      )}
      <input type="hidden" name="latitude" value={lat ?? ""} />
      <input type="hidden" name="longitude" value={lng ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={capture}>
          Use my current location
        </Button>
        <span className="text-xs text-ink/55">
          {lat != null && lng != null
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : "Not set"}
        </span>
      </div>
      {status && <p className="mt-2 text-xs text-ink/55">{status}</p>}
      <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
        <Field label="Staff clock-in radius (m)" htmlFor="o-radius">
          <Input
            id="o-radius"
            name="geofenceRadiusM"
            type="number"
            min={20}
            max={5000}
            defaultValue={geofenceRadiusM}
          />
        </Field>
        <Field label="Diner ordering radius (m)" htmlFor="o-order-radius">
          <Input
            id="o-order-radius"
            name="orderRadiusM"
            type="number"
            min={50}
            max={5000}
            defaultValue={orderRadiusM}
          />
        </Field>
      </div>
    </fieldset>
  );
}
