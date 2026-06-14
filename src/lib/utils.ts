import type { Prisma } from "@prisma/client";

// Minimal className combiner (avoids pulling in clsx/tailwind-merge).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Format money. Prisma Decimal serializes via toString(); accept number too.
export function formatMoney(
  amount: number | string | Prisma.Decimal,
  currency = "INR",
): string {
  const value = typeof amount === "number" ? amount : Number(amount.toString());
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function toNumber(value: number | string | Prisma.Decimal): number {
  return typeof value === "number" ? value : Number(value.toString());
}

// URL-safe slug from a free-text name.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// "HH:mm" current-time availability check for a menu item window.
export function isWithinWindow(
  from: string | null,
  to: string | null,
  now: Date = new Date(),
): boolean {
  if (!from || !to) return true;
  const mins = now.getHours() * 60 + now.getMinutes();
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + fm;
  const end = th * 60 + tm;
  // Handle windows that span midnight (e.g. 22:00 -> 02:00)
  if (start <= end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

// Summarise an OrderItem.modifiers JSON snapshot into "Full · Extra cheese".
export function modifierSummary(modifiers: unknown): string {
  if (!Array.isArray(modifiers)) return "";
  return (modifiers as Array<{ name?: string }>)
    .map((m) => m?.name)
    .filter(Boolean)
    .join(" · ");
}

// Returns the active happy-hour discount percent (0 if not currently active).
export function happyHourPercentNow(
  hh: {
    enabled: boolean;
    from: string | null;
    to: string | null;
    percent: number;
  },
  now: Date = new Date(),
): number {
  if (!hh.enabled || hh.percent <= 0) return 0;
  if (!isWithinWindow(hh.from, hh.to, now)) return 0;
  return hh.percent;
}


// Human label for an ordering point — prefixes "Room" for hotel in-room dining.
export function seatLabel(
  table: { label: string; kind?: string } | null | undefined,
): string {
  if (!table) return "Takeaway";
  return table.kind === "ROOM" ? `Room ${table.label}` : table.label;
}

// Great-circle distance in metres between two lat/lng points (haversine). Used
// to geofence staff clock-in/out near the venue.
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // earth radius (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Minutes → "3h 12m" / "45m" for attendance durations.
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h > 0 ? `${h}h ${mm}m` : `${mm}m`;
}
