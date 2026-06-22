// Subscription plan catalogue + capability model. Pure module so the marketing
// page, the admin billing screen, and the server-side capability gate all share
// one source of truth. Pricing is monthly (INR), GST added on top. Capabilities
// are enforced by tier (see src/lib/capabilities.ts).

export type PlanTier = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";

// A gateable product capability. Each maps to a paywalled feature/area.
export type Capability =
  | "onlinePayments"
  | "whatsapp"
  | "coupons"
  | "reservations"
  | "analytics"
  | "refunds"
  | "rooms"
  | "banquets"
  | "bar"
  | "kot"
  | "inventory"
  | "attendance"
  | "audit"
  | "multiProperty"
  | "integrations"
  | "sso";

// Ascending order. A tier grants its own capabilities PLUS every lower tier's.
export const TIER_ORDER: PlanTier[] = ["FREE", "STARTER", "PRO", "ENTERPRISE"];

const TIER_GRANTS: Record<PlanTier, Capability[]> = {
  FREE: [],
  STARTER: ["onlinePayments", "whatsapp", "coupons", "reservations", "analytics", "refunds"],
  PRO: ["rooms", "banquets", "bar", "kot", "inventory", "attendance", "audit"],
  ENTERPRISE: ["multiProperty", "integrations", "sso"],
};

// All capabilities a tier grants (cumulative across lower tiers).
export function capsForTier(tier: string): Capability[] {
  const idx = TIER_ORDER.indexOf(tier as PlanTier);
  const upTo = idx < 0 ? 0 : idx;
  return TIER_ORDER.slice(0, upTo + 1).flatMap((t) => TIER_GRANTS[t]);
}

export function tierIncludes(tier: string, cap: Capability): boolean {
  return capsForTier(tier).includes(cap);
}

// Lowest tier that grants a capability — drives "Upgrade to <plan>" copy.
export function minTierFor(cap: Capability): PlanTier {
  return TIER_ORDER.find((t) => TIER_GRANTS[t].includes(cap)) ?? "ENTERPRISE";
}

// Capabilities that also have a per-venue onboarding feature flag. The flag only
// takes effect when the tier grants the capability.
export const CAPABILITY_FEATURE_FLAG: Partial<Record<Capability, string>> = {
  reservations: "featureReservations",
  rooms: "featureRooms",
  banquets: "featureBanquets",
  bar: "featureBar",
  attendance: "featureAttendance",
};

// Short English labels for upgrade prompts / pricing rows.
export const CAPABILITY_LABEL: Record<Capability, string> = {
  onlinePayments: "Online payments",
  whatsapp: "WhatsApp bills & OTP",
  coupons: "Coupons & loyalty",
  reservations: "Reservations",
  analytics: "Analytics & export",
  refunds: "Refunds",
  rooms: "Hotel rooms",
  banquets: "Banquets",
  bar: "Bar KDS",
  kot: "KOT printing",
  inventory: "Inventory",
  attendance: "Staff attendance",
  audit: "Audit log",
  multiProperty: "Multi-property console",
  integrations: "Integrations & webhooks",
  sso: "SSO",
};

export type PlanLimits = {
  maxTables: number | null; // null = unlimited
  maxMenuItems: number | null;
  onlinePayments: boolean; // mirrors the onlinePayments capability
};

// Metered channels with a monthly included allowance + per-unit overage price.
export type UsageChannel = "whatsapp" | "email";

// Monthly included sends per channel. null = unlimited (Enterprise / custom).
export type UsageAllowance = Record<UsageChannel, number | null>;

// Overage price per unit beyond the monthly allowance, in ₹ (pre-GST). These
// carry margin over the upstream cost (Meta/Twilio per-message, Resend
// per-email); GST is added at billing time like the plan price. Tune here — the
// metering + billing read these, so it's the single source of truth.
export const OVERAGE_RATE: Record<UsageChannel, number> = {
  whatsapp: 0.8,
  email: 0.1,
};

export type Plan = {
  tier: PlanTier;
  name: string;
  price: number; // ₹ / month (0 on Free; ignored when contactOnly)
  tagline: string;
  features: string[];
  limits: PlanLimits;
  allowance: UsageAllowance; // monthly included WhatsApp/email sends
  highlight?: boolean;
  contactOnly?: boolean; // Enterprise — custom pricing, contact sales (no self-serve checkout)
};

// India SaaS GST. Displayed and charged on top of the listed price.
export const GST_RATE = 0.18;
// Annual billing bills 11 months (1 month free).
export const ANNUAL_MONTHS = 11;

export const PLANS: Plan[] = [
  {
    tier: "FREE",
    name: "Free",
    price: 0,
    tagline: "Get going with QR ordering.",
    features: [
      "1 outlet",
      "Up to 10 tables",
      "QR menu & ordering",
      "Live kitchen screen",
      "Pay at counter",
      "50 bill emails / mo",
    ],
    limits: { maxTables: 10, maxMenuItems: 50, onlinePayments: false },
    allowance: { whatsapp: 0, email: 50 },
  },
  {
    tier: "STARTER",
    name: "Starter",
    price: 999,
    tagline: "For a busy single restaurant or café.",
    highlight: true,
    features: [
      "Everything in Free, plus:",
      "Unlimited tables & menu items",
      "Online payments (Razorpay)",
      "WhatsApp bills & OTP",
      "1,000 WhatsApp + 2,000 emails / mo",
      "Coupons, happy hour & loyalty",
      "Reservations",
      "Analytics & CSV export",
      "Refunds",
    ],
    limits: { maxTables: null, maxMenuItems: null, onlinePayments: true },
    allowance: { whatsapp: 1000, email: 2000 },
  },
  {
    tier: "PRO",
    name: "Pro",
    price: 2499,
    tagline: "Full-service venues, bars & hotels.",
    features: [
      "Everything in Starter, plus:",
      "Hotel rooms & banquets",
      "Bar KDS & KOT thermal printing",
      "5,000 WhatsApp + 10,000 emails / mo",
      "Inventory & stock",
      "Staff attendance",
      "Audit log",
      "Priority email support",
    ],
    limits: { maxTables: null, maxMenuItems: null, onlinePayments: true },
    allowance: { whatsapp: 5000, email: 10000 },
  },
  {
    tier: "ENTERPRISE",
    name: "Enterprise",
    price: 0,
    contactOnly: true,
    tagline: "Chains & groups that need everything.",
    features: [
      "Everything in Pro, plus:",
      "Multi-property console",
      "Integrations & webhooks",
      "SSO",
      "Unlimited WhatsApp & emails",
      "Custom limits & SLA",
      "Dedicated support",
    ],
    limits: { maxTables: null, maxMenuItems: null, onlinePayments: true },
    allowance: { whatsapp: null, email: null },
  },
];

export function planByTier(tier: string): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}

export function planLimits(tier: string): PlanLimits {
  // Keep onlinePayments consistent with the capability matrix.
  return { ...planByTier(tier).limits, onlinePayments: tierIncludes(tier, "onlinePayments") };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Annual price = 11 × monthly (1 month free).
export function annualPrice(monthly: number): number {
  return round2(monthly * ANNUAL_MONTHS);
}

// GST amount on a base price (rupees).
export function gstAmount(amount: number): number {
  return round2(amount * GST_RATE);
}

// Price inclusive of GST (rupees) — the actual amount charged.
export function withGst(amount: number): number {
  return round2(amount * (1 + GST_RATE));
}

export type BillingCycle = "monthly" | "annual";

// Base price (pre-GST) for a plan at the chosen cycle.
export function cyclePrice(plan: Plan, cycle: BillingCycle): number {
  return cycle === "annual" ? annualPrice(plan.price) : plan.price;
}

// Days a paid period covers for the chosen cycle.
export function cycleDays(cycle: BillingCycle): number {
  return cycle === "annual" ? 365 : 30;
}

// --- Usage allowances & overage --------------------------------------------

// Monthly included sends per channel for a tier. Unknown/lapsed tiers fall back
// to FREE (mirrors the effective-tier soft-downgrade in the capability gate).
export function allowanceForTier(tier: string): UsageAllowance {
  return planByTier(tier).allowance;
}

// Billable units over the allowance for one channel (0 when unlimited/under).
export function overageUnits(used: number, allowance: number | null): number {
  if (allowance === null) return 0; // unlimited tier
  return Math.max(0, used - allowance);
}

export type UsageCounts = Record<UsageChannel, number>;

// Per-channel overage cost (pre-GST ₹) for a tier given this period's usage.
export function overageBreakdown(
  used: UsageCounts,
  tier: string,
): Record<UsageChannel, { units: number; cost: number }> {
  const a = allowanceForTier(tier);
  const channels: UsageChannel[] = ["whatsapp", "email"];
  const out = {} as Record<UsageChannel, { units: number; cost: number }>;
  for (const ch of channels) {
    const units = overageUnits(used[ch], a[ch]);
    out[ch] = { units, cost: round2(units * OVERAGE_RATE[ch]) };
  }
  return out;
}

// Total overage cost (pre-GST ₹) across channels.
export function overageCost(used: UsageCounts, tier: string): number {
  const b = overageBreakdown(used, tier);
  return round2(b.whatsapp.cost + b.email.cost);
}
