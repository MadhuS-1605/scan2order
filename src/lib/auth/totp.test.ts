import { describe, it, expect, vi, afterEach } from "vitest";
import { generateTotpSecret, verifyTotp, verifyTotpStep, totpUri } from "@/lib/auth/totp";

// RFC 6238 SHA-1 test vector: ASCII secret "12345678901234567890" in base32,
// at Unix time 59s (step 1) the code is 287082.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

afterEach(() => vi.useRealTimers());

describe("generateTotpSecret", () => {
  it("returns a 32-char base32 string (160-bit secret)", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s); // random
  });
});

describe("verifyTotp", () => {
  it("accepts the RFC 6238 vector at its timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59 * 1000));
    expect(verifyTotp(RFC_SECRET, "287082")).toBe(true);
  });
  it("rejects a wrong code", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59 * 1000));
    expect(verifyTotp(RFC_SECRET, "000000")).toBe(false);
  });
  it("rejects malformed input", () => {
    expect(verifyTotp(RFC_SECRET, "12345")).toBe(false);
    expect(verifyTotp(RFC_SECRET, "abcdef")).toBe(false);
  });
  it("rejects a code from a far-away time window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(10_000 * 1000)); // far from step 1
    expect(verifyTotp(RFC_SECRET, "287082")).toBe(false);
  });
});

describe("verifyTotpStep (replay guard primitive)", () => {
  it("returns the matched step counter so callers can reject reuse", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59 * 1000)); // step = floor(59/30) = 1
    const step = verifyTotpStep(RFC_SECRET, "287082");
    expect(step).toBe(1);
    // Same code, same window → same step. A caller storing lastTotpStep===1
    // can detect this as a replay and reject the second use.
    expect(verifyTotpStep(RFC_SECRET, "287082")).toBe(1);
  });
  it("returns null for a wrong code", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59 * 1000));
    expect(verifyTotpStep(RFC_SECRET, "000000")).toBe(null);
  });
});

describe("totpUri", () => {
  it("builds a scannable otpauth URI", () => {
    const uri = totpUri("ABC234", "admin@x.com", "Scan2Order");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABC234");
    expect(uri).toContain("issuer=Scan2Order");
  });
});
