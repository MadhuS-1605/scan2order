// Role-based access control. Pure module (no server-only deps) so it can be
// imported by client components (e.g. to filter the nav).

export type Permission =
  | "overview"
  | "orders"
  | "kitchen"
  | "monitor"
  | "menu"
  | "tables"
  | "analytics"
  | "settings"
  | "staff"
  | "attendance"
  | "refunds"
  | "properties";

const ALL: Permission[] = [
  "overview",
  "orders",
  "kitchen",
  "monitor",
  "menu",
  "tables",
  "analytics",
  "settings",
  "staff",
  "attendance",
  "refunds",
  "properties",
];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  OWNER: ALL,
  MANAGER: ALL.filter((p) => p !== "staff" && p !== "properties"),
  CASHIER: ["overview", "orders", "monitor"],
  WAITER: ["overview", "orders", "monitor"],
  KITCHEN: ["kitchen", "monitor"],
  STAFF: ["overview", "orders", "monitor"],
};

export function permissionsFor(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? ROLE_PERMISSIONS.STAFF;
}

export function hasPermission(role: string, perm: Permission): boolean {
  return permissionsFor(role).includes(perm);
}

// The first page a role should land on after signing in.
export function landingFor(role: string): string {
  const perms = permissionsFor(role);
  if (perms.includes("overview")) return "/admin";
  if (perms.includes("kitchen")) return "/admin/kitchen";
  if (perms.includes("orders")) return "/admin/orders";
  return "/admin/monitor";
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  KITCHEN: "Kitchen",
  STAFF: "Staff",
};

// Roles an owner/manager can assign to staff.
export const ASSIGNABLE_ROLES = [
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
] as const;
