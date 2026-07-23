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
import { ImageUpload } from "@/components/admin/image-upload";
import type { ActionState } from "@/lib/validation";
import { LANGUAGES } from "@/lib/languages";
import { updateTenantAction } from "@/lib/tenant/actions";
import { useT } from "@/components/admin/i18n-provider";

type Profile = {
  name: string;
  type: string;
  phone: string | null;
  email: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  fssaiNumber: string | null;
  logoUrl: string | null;
  brandColor: string | null;
};

type Config = {
  orderConfirmation: string;
  paymentTiming: string;
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  gstMode: string;
  gstNumber: string | null;
  gstPercentage: string;
  currency: string;
  serviceChargePercent: string;
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
  timezone: string;
  openTime: string | null;
  closeTime: string | null;
  orderingPaused: boolean;
  billFooterMessage: string | null;
  defaultPrepMinutes: number;
  minOrderAmount: number;
  dailyReportEmail: boolean;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
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
  wifiSsid: string | null;
  wifiPassword: string | null;
};

function Status({ state }: { state: ActionState }) {
  const tr = useT();
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok)
    return <Alert variant="success">{state.message ?? tr("settings.saved")}</Alert>;
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
  const tr = useT();
  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";
  return (
    <Card>
      <h2 className="font-semibold text-ink">{tr("settings.webAddress")}</h2>
      <p className="mt-1 text-sm text-ink/55">{tr("settings.webAddressDesc")}</p>
      <form action={updateTenantAction} className="mt-4 space-y-4">
        <Field label={tr("settings.usernameSubdomain")} htmlFor="t-sub">
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
          label={tr("settings.customDomain")}
          htmlFor="t-domain"
          hint={tr("settings.customDomainHint")}
        >
          <Input
            id="t-domain"
            name="customDomain"
            defaultValue={tenant.customDomain ?? ""}
            placeholder="order.yourrestaurant.com"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit">{tr("settings.saveWebAddress")}</Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    {},
  );
  const [customColor, setCustomColor] = useState(Boolean(profile.brandColor));
  return (
    <Card>
      <h2 className="font-semibold text-ink">{tr("settings.businessProfile")}</h2>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("common.name")} htmlFor="s-name">
            <Input id="s-name" name="name" defaultValue={profile.name} required />
          </Field>
          <Field label={tr("settings.type")} htmlFor="s-type">
            <Select id="s-type" name="type" defaultValue={profile.type}>
              <option value="RESTAURANT">{tr("settings.typeRestaurant")}</option>
              <option value="CAFE">{tr("settings.typeCafe")}</option>
              <option value="HOTEL">{tr("settings.typeHotel")}</option>
              <option value="CLOUD_KITCHEN">{tr("settings.typeCloudKitchen")}</option>
              <option value="BAR">{tr("settings.typeBar")}</option>
              <option value="QSR">{tr("settings.typeQsr")}</option>
              <option value="BAKERY">{tr("settings.typeBakery")}</option>
              <option value="PIZZERIA">{tr("settings.typePizzeria")}</option>
              <option value="BURGER_JOINT">{tr("settings.typeBurgerJoint")}</option>
              <option value="OTHER">{tr("settings.typeOther")}</option>
            </Select>
          </Field>
          <Field label={tr("settings.phone")} htmlFor="s-phone">
            <Input id="s-phone" name="phone" defaultValue={profile.phone ?? ""} />
          </Field>
          <Field label={tr("settings.email")} htmlFor="s-email">
            <Input
              id="s-email"
              name="email"
              type="email"
              defaultValue={profile.email ?? ""}
            />
          </Field>
        </div>
        <Field label={tr("settings.address")} htmlFor="s-addr">
          <Input
            id="s-addr"
            name="addressLine"
            defaultValue={profile.addressLine ?? ""}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tr("settings.city")} htmlFor="s-city">
            <Input id="s-city" name="city" defaultValue={profile.city ?? ""} />
          </Field>
          <Field label={tr("settings.state")} htmlFor="s-state">
            <Input id="s-state" name="state" defaultValue={profile.state ?? ""} />
          </Field>
          <Field label={tr("settings.pin")} htmlFor="s-pin">
            <Input
              id="s-pin"
              name="postalCode"
              defaultValue={profile.postalCode ?? ""}
            />
          </Field>
        </div>
        <Field label={tr("settings.fssaiNumber")} htmlFor="s-fssai" hint={tr("settings.fssaiHint")}>
          <Input
            id="s-fssai"
            name="fssaiNumber"
            defaultValue={profile.fssaiNumber ?? ""}
            placeholder="e.g. 12345678901234"
          />
        </Field>
        <Field label={tr("settings.logoUrl")} htmlFor="s-logo" hint={tr("settings.logoUrlHint")}>
          <ImageUpload name="logoUrl" kind="logo" defaultValue={profile.logoUrl ?? ""} />
        </Field>
        <Field label="Brand color" htmlFor="s-brand-color" hint="Accent color for your guest-facing menu & bill.">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={customColor}
                onChange={(e) => setCustomColor(e.target.checked)}
              />
              Use a custom color
            </label>
            {customColor && (
              <input
                id="s-brand-color"
                type="color"
                name="brandColor"
                defaultValue={profile.brandColor ?? "#d93d0b"}
                className="h-10 w-14 cursor-pointer rounded border border-sand-300 bg-surface p-1"
              />
            )}
          </div>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? tr("common.saving") : tr("settings.saveProfile")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function OperationsForm({ config }: { config: Config }) {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateOperationsAction,
    {},
  );
  const [gstMode, setGstMode] = useState(config.gstMode);
  return (
    <Card>
      <h2 className="font-semibold text-ink">{tr("settings.operationsTitle")}</h2>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("settings.orderConfirmation")} htmlFor="o-confirm">
            <Select
              id="o-confirm"
              name="orderConfirmation"
              defaultValue={config.orderConfirmation}
            >
              <option value="AUTO">{tr("settings.orderConfirmAuto")}</option>
              <option value="WAITER_CONFIRM">{tr("settings.orderConfirmWaiter")}</option>
            </Select>
          </Field>
          <Field label={tr("settings.paymentTiming")} htmlFor="o-timing">
            <Select
              id="o-timing"
              name="paymentTiming"
              defaultValue={config.paymentTiming}
            >
              <option value="PAY_AFTER">{tr("settings.payAfter")}</option>
              <option value="PAY_BEFORE">{tr("settings.payBefore")}</option>
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
            {tr("settings.onlinePayment")}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="counterPaymentEnabled"
              defaultChecked={config.counterPaymentEnabled}
            />
            {tr("settings.payAtCounter")}
          </label>
        </div>
        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            {tr("settings.takeawayDelivery")}
          </legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="pickupEnabled" defaultChecked={config.pickupEnabled} />
              {tr("settings.offerPickup")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="deliveryEnabled" defaultChecked={config.deliveryEnabled} />
              {tr("settings.offerDelivery")}
            </label>
          </div>
          <p className="mt-2 text-xs text-ink/45">{tr("settings.takeawayDeliveryHint")}</p>
        </fieldset>
        <fieldset className="rounded-lg border border-sand-200 p-3">
          <legend className="px-1 text-sm font-medium text-ink/70">
            {tr("settings.serviceHours")}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="orderingPaused"
              defaultChecked={config.orderingPaused}
            />
            {tr("settings.pauseOrders")}
          </label>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Field label={tr("settings.opensAt")} htmlFor="o-open" hint={tr("settings.blankFor24h")}>
              <Input
                id="o-open"
                name="openTime"
                type="time"
                defaultValue={config.openTime ?? ""}
              />
            </Field>
            <Field label={tr("settings.closesAt")} htmlFor="o-close" hint={tr("settings.blankFor24h")}>
              <Input
                id="o-close"
                name="closeTime"
                type="time"
                defaultValue={config.closeTime ?? ""}
              />
            </Field>
            <Field label={tr("settings.timezone")} htmlFor="o-tz" hint={tr("settings.timezoneHint")}>
              <Input
                id="o-tz"
                name="timezone"
                defaultValue={config.timezone}
                placeholder="Asia/Kolkata"
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink/45">{tr("settings.serviceHoursHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field
              label={tr("settings.defaultPrepTime")}
              htmlFor="o-prep"
              hint={tr("settings.defaultPrepHint")}
            >
              <Input
                id="o-prep"
                name="defaultPrepMinutes"
                type="number"
                min="0"
                max="180"
                defaultValue={String(config.defaultPrepMinutes)}
                className="max-w-[8rem]"
              />
            </Field>
            <Field
              label={tr("settings.minOrderAmount")}
              htmlFor="o-minorder"
              hint={tr("settings.minOrderHint")}
            >
              <Input
                id="o-minorder"
                name="minOrderAmount"
                type="number"
                min="0"
                defaultValue={String(config.minOrderAmount)}
                className="max-w-[8rem]"
              />
            </Field>
          </div>
        </fieldset>

        <Field
          label={tr("settings.billFooter")}
          htmlFor="o-footer"
          hint={tr("settings.billFooterHint")}
        >
          <Input
            id="o-footer"
            name="billFooterMessage"
            defaultValue={config.billFooterMessage ?? ""}
            placeholder="e.g. Thank you for dining with us!"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input type="checkbox" name="dailyReportEmail" defaultChecked={config.dailyReportEmail} />
          {tr("settings.dailyReportEmail")}
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={tr("settings.gstMode")} htmlFor="o-gst">
            <Select
              id="o-gst"
              name="gstMode"
              value={gstMode}
              onChange={(e) => setGstMode(e.target.value)}
            >
              <option value="NONE">{tr("settings.gstNone")}</option>
              <option value="EXCLUSIVE">{tr("settings.gstExclusive")}</option>
              <option value="INCLUSIVE">{tr("settings.gstInclusive")}</option>
            </Select>
          </Field>
          <Field label={tr("settings.gstPercent")} htmlFor="o-pct">
            <Input
              id="o-pct"
              name="gstPercentage"
              type="number"
              step="0.01"
              defaultValue={config.gstPercentage}
              disabled={gstMode === "NONE"}
            />
          </Field>
          <Field
            label="Currency"
            htmlFor="o-currency"
            hint="Display only — online payments (Razorpay/UPI) always settle in INR regardless of this."
          >
            <Select id="o-currency" name="currency" defaultValue={config.currency}>
              {["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD"].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={tr("settings.serviceCharge")} htmlFor="o-sc" hint={tr("settings.serviceChargeHint")}>
            <Input
              id="o-sc"
              name="serviceChargePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={config.serviceChargePercent}
            />
          </Field>
          <Field label={tr("settings.gstin")} htmlFor="o-num">
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
            {tr("settings.menuLanguages")}
          </legend>
          <p className="mb-2 text-xs text-ink/45">{tr("settings.menuLanguagesHint")}</p>
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
            {tr("settings.happyHour")}
          </legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="happyHourEnabled"
              defaultChecked={config.happyHourEnabled}
            />
            {tr("settings.happyHourEnable")}
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Field label={tr("settings.from")} htmlFor="hh-from">
              <Input
                id="hh-from"
                name="happyHourFrom"
                type="time"
                defaultValue={config.happyHourFrom ?? ""}
              />
            </Field>
            <Field label={tr("settings.to")} htmlFor="hh-to">
              <Input
                id="hh-to"
                name="happyHourTo"
                type="time"
                defaultValue={config.happyHourTo ?? ""}
              />
            </Field>
            <Field label={tr("settings.percentOff")} htmlFor="hh-pct">
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
            {tr("settings.kitchenPrinter")}
          </legend>
          <p className="mb-3 text-xs text-ink/50">{tr("settings.kitchenPrinterHint")}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Field label={tr("settings.printerIp")} htmlFor="kot-host">
                <Input
                  id="kot-host"
                  name="kotPrinterHost"
                  placeholder="192.168.1.50"
                  defaultValue={config.kotPrinterHost ?? ""}
                />
              </Field>
            </div>
            <Field label={tr("settings.port")} htmlFor="kot-port">
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
            {tr("settings.modules")}
          </legend>
          <p className="mb-3 text-xs text-ink/50">{tr("settings.modulesHint")}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { name: "featureReservations", label: tr("settings.moduleReservations"), on: config.featureReservations },
              { name: "featureRooms", label: tr("settings.moduleRooms"), on: config.featureRooms },
              { name: "featureBanquets", label: tr("settings.moduleBanquets"), on: config.featureBanquets },
              { name: "featureBar", label: tr("settings.moduleBar"), on: config.featureBar },
              { name: "featureAttendance", label: tr("settings.moduleAttendance"), on: config.featureAttendance },
              { name: "requireDinerLocation", label: tr("settings.moduleRequireLocation"), on: config.requireDinerLocation },
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
          label={tr("settings.reviewLink")}
          htmlFor="o-review"
          hint={tr("settings.reviewLinkHint")}
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
            {pending ? tr("common.saving") : tr("settings.saveSettings")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentForm({ config }: { config: Config }) {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updatePaymentCredsAction,
    {},
  );
  return (
    <Card>
      <h2 className="font-semibold text-ink">{tr("settings.credentialsTitle")}</h2>
      <p className="mt-1 text-sm text-ink/55">{tr("settings.credentialsDesc")}</p>
      <form action={action} className="mt-4 space-y-4">
        <Status state={state} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tr("settings.razorpayKeyId")} htmlFor="r-id">
            <Input
              id="r-id"
              name="razorpayKeyId"
              defaultValue={config.razorpayKeyId ?? ""}
              placeholder="rzp_live_xxx"
            />
          </Field>
          <Field
            label={tr("settings.razorpayKeySecret")}
            htmlFor="r-secret"
            hint={
              config.hasRazorpaySecret
                ? tr("settings.razorpaySecretSaved")
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
          label={tr("settings.whatsappSender")}
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
            label={tr("settings.upiId")}
            htmlFor="upi-id"
            hint={tr("settings.upiIdHint")}
          >
            <Input
              id="upi-id"
              name="upiId"
              defaultValue={config.upiId ?? ""}
              placeholder="yourcafe@oksbi"
            />
          </Field>
          <Field label={tr("settings.upiPayeeName")} htmlFor="upi-name">
            <Input
              id="upi-name"
              name="upiName"
              defaultValue={config.upiName ?? ""}
              placeholder="Your Café"
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Guest Wi-Fi name" htmlFor="wifi-ssid" hint="Shown on the guest menu page.">
            <Input id="wifi-ssid" name="wifiSsid" defaultValue={config.wifiSsid ?? ""} placeholder="CafeGuest" />
          </Field>
          <Field label="Guest Wi-Fi password" htmlFor="wifi-password">
            <Input
              id="wifi-password"
              name="wifiPassword"
              defaultValue={config.wifiPassword ?? ""}
              placeholder="Leave blank if open network"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? tr("common.saving") : tr("settings.saveCredentials")}
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
  const tr = useT();
  const [lat, setLat] = useState<number | null>(latitude);
  const [lng, setLng] = useState<number | null>(longitude);
  const [status, setStatus] = useState<string | null>(null);
  const missing = requireDinerLocation && lat == null && lng == null;

  function capture() {
    if (!("geolocation" in navigator)) {
      setStatus(tr("settings.geoUnavailable"));
      return;
    }
    setStatus(tr("settings.locating"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude);
        setLng(p.coords.longitude);
        setStatus(tr("settings.locationCaptured"));
      },
      () => setStatus(tr("settings.locationFailed")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <fieldset className="rounded-lg border border-sand-200 p-3">
      <legend className="px-1 text-sm font-medium text-ink/70">
        {tr("settings.venueLocation")}
      </legend>
      <p className="mb-3 text-xs text-ink/50">{tr("settings.venueLocationHint")}</p>
      {missing && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⚠ {tr("settings.venueLocationMissing")}
        </p>
      )}
      <input type="hidden" name="latitude" value={lat ?? ""} />
      <input type="hidden" name="longitude" value={lng ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="secondary" onClick={capture}>
          {tr("settings.useCurrentLocation")}
        </Button>
        <span className="text-xs text-ink/55">
          {lat != null && lng != null
            ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            : tr("settings.notSet")}
        </span>
      </div>
      {status && <p className="mt-2 text-xs text-ink/55">{status}</p>}
      <div className="mt-3 grid max-w-md gap-3 sm:grid-cols-2">
        <Field label={tr("settings.staffClockInRadius")} htmlFor="o-radius">
          <Input
            id="o-radius"
            name="geofenceRadiusM"
            type="number"
            min={20}
            max={5000}
            defaultValue={geofenceRadiusM}
          />
        </Field>
        <Field label={tr("settings.dinerOrderingRadius")} htmlFor="o-order-radius">
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
