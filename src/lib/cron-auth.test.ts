import { describe, it, expect } from "vitest";
import { cronAuthorized } from "@/lib/cron-auth";

const secret = "cron-secret-value-1234567890";
const req = (headers: Record<string, string> = {}, url = "https://x/api/cron/sweep") =>
  new Request(url, { headers });

describe("cronAuthorized", () => {
  it("accepts the correct bearer token", () => {
    expect(cronAuthorized(req({ authorization: `Bearer ${secret}` }), secret)).toBe(true);
  });
  it("rejects a wrong or missing token", () => {
    expect(cronAuthorized(req({ authorization: "Bearer nope" }), secret)).toBe(false);
    expect(cronAuthorized(req(), secret)).toBe(false);
  });
  it("ignores the secret in a query string (header-only)", () => {
    expect(cronAuthorized(req({}, `https://x/api/cron/sweep?key=${secret}`), secret)).toBe(false);
  });
});
