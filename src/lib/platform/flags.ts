import "server-only";
import { prisma } from "@/lib/db";
import { reportError } from "@/lib/observability";

// Global platform kill switches. The registry is the source of truth for which
// flags exist + their default; the FeatureFlag table only stores overrides.
//
// Reads are cached briefly and FAIL-OPEN (a DB hiccup returns the default), so a
// flag check can never break a send/signup. Toggles propagate within the TTL.

export type FlagKey =
  | "signups_enabled"
  | "whatsapp_enabled"
  | "email_enabled"
  | "online_payments_enabled"
  | "ordering_enabled";

export const FLAGS: { key: FlagKey; label: string; description: string; default: boolean }[] = [
  { key: "signups_enabled", label: "New signups", description: "Allow new owners to create an account.", default: true },
  { key: "whatsapp_enabled", label: "WhatsApp sending", description: "Master switch for all WhatsApp messages.", default: true },
  { key: "email_enabled", label: "Email sending", description: "Master switch for all transactional email.", default: true },
  { key: "online_payments_enabled", label: "Online payments", description: "Allow diners to pay online (Razorpay) across all venues. Off = counter pay only.", default: true },
  { key: "ordering_enabled", label: "Diner ordering", description: "Master switch for placing orders. Off = maintenance mode (diners can browse, not order).", default: true },
];

const DEFAULTS = new Map(FLAGS.map((f) => [f.key, f.default]));
const TTL_MS = 30_000;
const cache = new Map<FlagKey, { value: boolean; exp: number }>();

export async function flagEnabled(key: FlagKey): Promise<boolean> {
  const def = DEFAULTS.get(key) ?? true;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.value;
  try {
    const row = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true } });
    const value = row?.enabled ?? def;
    cache.set(key, { value, exp: Date.now() + TTL_MS });
    return value;
  } catch (e) {
    reportError("flags.read", e, { key });
    return def; // fail open
  }
}

// Current state of every known flag (for the admin UI). Resolves overrides; falls
// back to defaults. Not cached — only the management page calls it.
export async function allFlags(): Promise<{ key: FlagKey; label: string; description: string; enabled: boolean }[]> {
  const rows = await prisma.featureFlag.findMany({ select: { key: true, enabled: true } });
  const override = new Map(rows.map((r) => [r.key, r.enabled]));
  return FLAGS.map((f) => ({ key: f.key, label: f.label, description: f.description, enabled: override.get(f.key) ?? f.default }));
}

// Upsert a flag override and bust the local cache for immediate effect.
export async function setFlag(key: FlagKey, enabled: boolean): Promise<void> {
  await prisma.featureFlag.upsert({ where: { key }, create: { key, enabled }, update: { enabled } });
  cache.set(key, { value: enabled, exp: Date.now() + TTL_MS });
}
