import { describe, it, expect, beforeAll, vi } from "vitest";
import { SignJWT } from "jose";

// session.ts imports next/headers at module load; stub it (these helpers never call it).
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

import { createMfaToken, verifyMfaToken } from "@/lib/auth/session";

const SECRET = "x".repeat(40);

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

describe("MFA token (password-bound 2FA step)", () => {
  it("round-trips the user id", async () => {
    const token = await createMfaToken("user_abc");
    expect(await verifyMfaToken(token)).toBe("user_abc");
  });

  it("rejects garbage and empty input", async () => {
    expect(await verifyMfaToken("not-a-jwt")).toBe(null);
    expect(await verifyMfaToken("")).toBe(null);
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await new SignJWT({ typ: "mfa" })
      .setSubject("user_abc")
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode("y".repeat(40)));
    expect(await verifyMfaToken(forged)).toBe(null);
  });

  it("rejects a correctly-signed token that is not typ:mfa (e.g. a session JWT)", async () => {
    const sessionLike = await new SignJWT({ typ: "session" })
      .setSubject("user_abc")
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyMfaToken(sessionLike)).toBe(null);
  });
});
