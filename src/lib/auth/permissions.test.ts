import { describe, it, expect } from "vitest";
import { hasPermission, permissionsFor, landingFor } from "@/lib/auth/permissions";

describe("permissions", () => {
  it("OWNER has everything including staff/attendance/properties", () => {
    const p = permissionsFor("OWNER");
    expect(p).toContain("staff");
    expect(p).toContain("attendance");
    expect(p).toContain("properties");
  });

  it("MANAGER has attendance but not staff/properties", () => {
    expect(hasPermission("MANAGER", "attendance")).toBe(true);
    expect(hasPermission("MANAGER", "orders")).toBe(true);
    expect(hasPermission("MANAGER", "staff")).toBe(false);
    expect(hasPermission("MANAGER", "properties")).toBe(false);
  });

  it("WAITER can take orders but not change settings or staff", () => {
    expect(hasPermission("WAITER", "orders")).toBe(true);
    expect(hasPermission("WAITER", "settings")).toBe(false);
    expect(hasPermission("WAITER", "staff")).toBe(false);
    expect(hasPermission("WAITER", "attendance")).toBe(false);
  });

  it("KITCHEN sees kitchen but not the orders board", () => {
    expect(hasPermission("KITCHEN", "kitchen")).toBe(true);
    expect(hasPermission("KITCHEN", "orders")).toBe(false);
  });

  it("unknown role falls back to STAFF perms", () => {
    expect(permissionsFor("NONSENSE")).toEqual(permissionsFor("STAFF"));
  });

  it("landingFor routes each role to its home", () => {
    expect(landingFor("OWNER")).toBe("/admin");
    expect(landingFor("MANAGER")).toBe("/admin");
    // WAITER has the "overview" perm, so it lands on /admin too.
    expect(landingFor("WAITER")).toBe("/admin");
    // KITCHEN lacks overview/orders → kitchen screen.
    expect(landingFor("KITCHEN")).toBe("/admin/kitchen");
  });
});
