import { describe, it, expect } from "vitest";
import {
  staffSchema,
  staffSigninSchema,
  placeOrderSchema,
} from "@/lib/validation";

describe("staffSchema", () => {
  const base = { name: "Asha", username: "asha1", password: "password123", role: "WAITER" };
  it("accepts a valid staff record", () => {
    expect(staffSchema.safeParse(base).success).toBe(true);
  });
  it("rejects short / invalid usernames", () => {
    expect(staffSchema.safeParse({ ...base, username: "ab" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, username: "bad name" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, username: "bad!" }).success).toBe(false);
  });
  it("rejects short passwords and bad roles", () => {
    expect(staffSchema.safeParse({ ...base, password: "short" }).success).toBe(false);
    expect(staffSchema.safeParse({ ...base, role: "OWNER" }).success).toBe(false);
  });
});

describe("staffSigninSchema", () => {
  it("requires code, username, password", () => {
    expect(
      staffSigninSchema.safeParse({ code: "spicegarden", username: "asha", password: "x" })
        .success,
    ).toBe(true);
    expect(staffSigninSchema.safeParse({ username: "asha", password: "x" }).success).toBe(
      false,
    );
  });
});

describe("placeOrderSchema", () => {
  it("requires at least one item", () => {
    expect(placeOrderSchema.safeParse({ qrToken: "t", items: [] }).success).toBe(false);
  });
  it("accepts a valid order with optional coords", () => {
    const r = placeOrderSchema.safeParse({
      qrToken: "tok",
      items: [{ menuItemId: "m1", quantity: 2, optionIds: ["o1"] }],
      latitude: 12.9352,
      longitude: 77.6245,
    });
    expect(r.success).toBe(true);
  });
  it("rejects non-numeric coords and zero-quantity items", () => {
    expect(
      placeOrderSchema.safeParse({
        qrToken: "t",
        items: [{ menuItemId: "m1", quantity: 0 }],
      }).success,
    ).toBe(false);
    expect(
      placeOrderSchema.safeParse({
        qrToken: "t",
        items: [{ menuItemId: "m1", quantity: 1 }],
        latitude: "nope",
      }).success,
    ).toBe(false);
  });
});
