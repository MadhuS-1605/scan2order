import { describe, it, expect } from "vitest";
import { validateSubdomain, normalizeSubdomain } from "@/lib/subdomain";

describe("normalizeSubdomain", () => {
  it("lowercases and strips invalid chars", () => {
    expect(normalizeSubdomain("  Spice Garden! ")).toBe("spicegarden");
  });
});

describe("validateSubdomain", () => {
  it("accepts a valid subdomain", () => {
    const r = validateSubdomain("spicegarden");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("spicegarden");
  });
  it("rejects too short", () => {
    expect(validateSubdomain("ab").ok).toBe(false);
  });
  it("rejects reserved words", () => {
    expect(validateSubdomain("admin").ok).toBe(false);
    expect(validateSubdomain("signin").ok).toBe(false);
  });
  it("must start and end alphanumeric", () => {
    expect(validateSubdomain("-abc").ok).toBe(false);
    expect(validateSubdomain("abc-").ok).toBe(false);
  });
});
