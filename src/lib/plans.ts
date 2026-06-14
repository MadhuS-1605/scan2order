// Subscription plan catalogue. Pure module so both the marketing page and the
// admin billing screen can import it. Pricing is monthly (INR). Changing a plan
// is scaffolding today (no payment gateway wired) — it just records the tier.

export type PlanTier = "FREE" | "STARTER" | "PRO";

export type Plan = {
  tier: PlanTier;
  name: string;
  price: number; // ₹ / month
  tagline: string;
  features: string[];
  highlight?: boolean;
};

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
    ],
  },
  {
    tier: "STARTER",
    name: "Starter",
    price: 999,
    tagline: "For a busy single restaurant or café.",
    highlight: true,
    features: [
      "Unlimited tables",
      "Online payments (Razorpay)",
      "WhatsApp bills & OTP",
      "Coupons, happy hour & loyalty",
      "Analytics & CSV export",
    ],
  },
  {
    tier: "PRO",
    name: "Pro",
    price: 2499,
    tagline: "Chains & hotels that need everything.",
    features: [
      "Multi-property console",
      "Hotel rooms & banquets",
      "KOT thermal printing",
      "Integrations & webhooks",
      "Audit log & priority support",
    ],
  },
];

export function planByTier(tier: string): Plan {
  return PLANS.find((p) => p.tier === tier) ?? PLANS[0];
}
