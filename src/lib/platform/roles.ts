// Platform-operator capabilities by sub-role. Pure module so both server actions
// (gating) and pages/components (hiding controls) share one matrix.

export type PlatformRole = "FULL" | "BILLING" | "SUPPORT";

// Capabilities a platform operator can hold.
//  - tenants.manage: suspend/reactivate, impersonate
//  - billing.manage: set/grant plans, view revenue dashboard
//  - platform.manage: announcements, feature flags, operator roles
export type PlatformCapability = "tenants.manage" | "billing.manage" | "platform.manage";

const GRANTS: Record<PlatformRole, PlatformCapability[]> = {
  FULL: ["tenants.manage", "billing.manage", "platform.manage"],
  BILLING: ["billing.manage"],
  SUPPORT: ["tenants.manage"],
};

export function platformCan(role: PlatformRole, cap: PlatformCapability): boolean {
  return GRANTS[role]?.includes(cap) ?? false;
}

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
  FULL: "Full access",
  BILLING: "Billing",
  SUPPORT: "Support",
};
