import type { Prisma } from "@prisma/client";

// Minimal className combiner (avoids pulling in clsx/tailwind-merge).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

// Escape user-controlled text before interpolating into an HTML string (emails).
// React escapes JSX automatically; this is for hand-built HTML template strings.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
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
// Current minutes-since-midnight in an IANA timezone (e.g. "Asia/Kolkata").
// Falls back to the server's local time when no tz is given. All venue
// time-of-day logic must pass the venue timezone so it doesn't drift on a
// UTC host.
export function minutesOfDayInTz(tz?: string, date: Date = new Date()): number {
  if (!tz) return date.getHours() * 60 + date.getMinutes();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function isWithinWindow(
  from: string | null,
  to: string | null,
  tz?: string,
  now: Date = new Date(),
): boolean {
  if (!from || !to) return true;
  const mins = minutesOfDayInTz(tz, now);
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const start = fh * 60 + fm;
  const end = th * 60 + tm;
  // Handle windows that span midnight (e.g. 22:00 -> 02:00)
  if (start <= end) return mins >= start && mins <= end;
  return mins >= start || mins <= end;
}

// Whether the venue is currently accepting new diner orders, considering the
// manual pause switch and the daily ordering window (both in venue tz).
export function venueOrderingOpen(cfg: {
  orderingPaused: boolean;
  openTime: string | null;
  closeTime: string | null;
  timezone: string;
}): { open: boolean; reason: "paused" | "closed" | null } {
  if (cfg.orderingPaused) return { open: false, reason: "paused" };
  if (
    cfg.openTime &&
    cfg.closeTime &&
    !isWithinWindow(cfg.openTime, cfg.closeTime, cfg.timezone)
  ) {
    return { open: false, reason: "closed" };
  }
  return { open: true, reason: null };
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
  tz?: string,
  now: Date = new Date(),
): number {
  if (!hh.enabled || hh.percent <= 0) return 0;
  if (!isWithinWindow(hh.from, hh.to, tz, now)) return 0;
  return hh.percent;
}


// Human label for an ordering point — prefixes "Room" for hotel in-room dining.
export function seatLabel(
  table: { label: string; kind?: string } | null | undefined,
): string {
  if (!table) return "Takeaway";
  if (table.kind === "ROOM") return `Room ${table.label}`;
  // Self-service venue's single ordering/pickup point — show "Pickup", not a
  // table number, since there are no tables.
  if (table.kind === "COUNTER") return "Pickup";
  return table.label;
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
