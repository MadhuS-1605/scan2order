// Subdomain / username validation. Pure module (client + server safe).

// Reserved so a restaurant username can never collide with an app route or
// platform host.
export const RESERVED_SUBDOMAINS = new Set([
  "admin",
  "api",
  "app",
  "www",
  "m",
  "t",
  "r",
  "go",
  "book",
  "menu",
  "account",
  "signin",
  "signup",
  "login",
  "logout",
  "onboarding",
  "dashboard",
  "static",
  "assets",
  "_next",
  "mail",
  "blog",
  "help",
  "support",
  "status",
  "scan",
]);

export function normalizeSubdomain(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function validateSubdomain(
  input: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const value = normalizeSubdomain(input);
  if (value.length < 3) return { ok: false, error: "At least 3 characters." };
  if (value.length > 30) return { ok: false, error: "At most 30 characters." };
  if (!/^[a-z0-9]/.test(value) || !/[a-z0-9]$/.test(value))
    return { ok: false, error: "Must start and end with a letter or number." };
  if (RESERVED_SUBDOMAINS.has(value))
    return { ok: false, error: "That name is reserved." };
  return { ok: true, value };
}
