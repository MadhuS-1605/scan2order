// Pure subscription-state logic (no server-only deps) so it can be used in
// server components, actions, and the billing UI. Pay-to-extend model: a paid
// tier is valid until `planActiveUntil`; once it lapses the venue falls back to
// FREE-tier limits/features (a soft gate — diner ordering keeps working).

export type SubStatus = "FREE" | "TRIAL" | "ACTIVE" | "EXPIRED";

export type SubState = {
  tier: string; // the chosen/selected tier
  effectiveTier: string; // tier actually granted right now (FREE if lapsed)
  status: SubStatus;
  daysLeft: number | null; // for trial/active; null on FREE
  isTrial: boolean;
};

const DAY = 24 * 60 * 60 * 1000;

export function subscriptionState(
  r: { planTier: string; planActiveUntil: Date | null; planIsTrial: boolean },
  now: Date = new Date(),
): SubState {
  if (r.planTier === "FREE") {
    return { tier: "FREE", effectiveTier: "FREE", status: "FREE", daysLeft: null, isTrial: false };
  }
  const until = r.planActiveUntil ? r.planActiveUntil.getTime() : 0;
  const active = until > now.getTime();
  const daysLeft = r.planActiveUntil
    ? Math.max(0, Math.ceil((until - now.getTime()) / DAY))
    : 0;
  if (active) {
    return {
      tier: r.planTier,
      effectiveTier: r.planTier,
      status: r.planIsTrial ? "TRIAL" : "ACTIVE",
      daysLeft,
      isTrial: r.planIsTrial,
    };
  }
  // Lapsed paid/trial period -> soft-downgrade to FREE limits.
  return { tier: r.planTier, effectiveTier: "FREE", status: "EXPIRED", daysLeft: 0, isTrial: r.planIsTrial };
}
