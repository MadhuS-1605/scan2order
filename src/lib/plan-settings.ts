import "server-only";
import { prisma } from "@/lib/db";
import { PLANS, planByTier, type Plan } from "@/lib/plans";

// Operator-editable plan pricing (price + trial length), overriding the code
// defaults in plans.ts. Cached briefly; cache is busted on save. Capabilities,
// limits and allowances stay code-defined.

const TTL_MS = 30_000;
let cache: { at: number; map: Map<string, { price: number; trialDays: number }> } | null = null;

async function load(): Promise<Map<string, { price: number; trialDays: number }>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.map;
  try {
    const rows = await prisma.planSetting.findMany();
    const map = new Map(rows.map((r) => [r.tier, { price: r.price, trialDays: r.trialDays }]));
    cache = { at: Date.now(), map };
    return map;
  } catch {
    // The DB is unreachable or the table isn't migrated yet (e.g. a deploy where
    // pre-deploy `db push` hasn't run). Fall back to the code-defined plan
    // defaults so the public landing page / healthcheck never hard-fails —
    // every caller already falls back per-tier to plans.ts for missing tiers.
    return new Map();
  }
}

export const DEFAULT_TRIAL_DAYS = 14;

export async function resolvePlanPrice(tier: string): Promise<number> {
  return (await load()).get(tier)?.price ?? planByTier(tier).price;
}

export async function trialDaysFor(tier: string): Promise<number> {
  return (await load()).get(tier)?.trialDays ?? DEFAULT_TRIAL_DAYS;
}

// PLANS with prices overridden, for display (cards, MRR).
export async function resolvePlans(): Promise<Plan[]> {
  const map = await load();
  return PLANS.map((p) => {
    const o = map.get(p.tier);
    return o ? { ...p, price: o.price } : p;
  });
}

export async function allPlanPricing(): Promise<
  { tier: string; name: string; price: number; trialDays: number; contactOnly: boolean }[]
> {
  const map = await load();
  return PLANS.map((p) => {
    const o = map.get(p.tier);
    return {
      tier: p.tier,
      name: p.name,
      price: o?.price ?? p.price,
      trialDays: o?.trialDays ?? DEFAULT_TRIAL_DAYS,
      contactOnly: Boolean(p.contactOnly),
    };
  });
}

export async function setPlanPricing(tier: string, price: number, trialDays: number): Promise<void> {
  const def = planByTier(tier);
  await prisma.planSetting.upsert({
    where: { tier },
    create: {
      tier,
      price,
      trialDays,
      whatsappAllowance: def.allowance.whatsapp ?? 0,
      emailAllowance: def.allowance.email ?? 0,
    },
    update: { price, trialDays },
  });
  cache = null; // bust so changes take effect immediately
}
