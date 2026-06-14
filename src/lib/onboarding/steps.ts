// Onboarding step order (kept in OnboardingConfig.onboardingStep).
// Lives outside the "use server" actions module, which may only export
// async functions.
export const STEPS = ["profile", "menu", "settings", "tables", "done"] as const;

export type Step = (typeof STEPS)[number];
