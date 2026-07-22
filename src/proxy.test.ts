import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

// PLATFORM_DOMAIN defaults to "scan.to" when NEXT_PUBLIC_PLATFORM_DOMAIN is unset.
function req(urlStr: string) {
  const url = new URL(urlStr);
  return new NextRequest(url, { headers: { host: url.host } });
}
const rewriteTo = (res: Response) => res.headers.get("x-middleware-rewrite");

describe("proxy — tenant subdomain routing", () => {
  it("rewrites the table-label path to /<sub>/<table>", () => {
    const res = proxy(req("https://spicegarden.scan.to/T1"));
    expect(rewriteTo(res)).toContain("/spicegarden/T1");
  });

  it("rewrites /signin to the scoped staff login", () => {
    const res = proxy(req("https://spicegarden.scan.to/signin"));
    expect(rewriteTo(res)).toContain("/r/spicegarden/signin");
  });

  it.each(["menu", "cart", "checkout", "payment", "account"])(
    "does NOT rewrite the reserved app route /%s",
    (path) => {
      const res = proxy(req(`https://spicegarden.scan.to/${path}`));
      // Must pass through (no rewrite) rather than be mangled into /<sub>/<path>.
      expect(rewriteTo(res)).toBeNull();
    },
  );

  it("sets the table cookie and redirects /t/<token> to /menu", () => {
    const res = proxy(req("https://spicegarden.scan.to/t/abc123"));
    expect(res.headers.get("location")).toContain("/menu");
    expect(res.headers.get("set-cookie")).toContain("sto_table=abc123");
  });

  it("ignores non-tenant hosts (no rewrite)", () => {
    const res = proxy(req("https://scan2order.up.railway.app/spicegarden/T1"));
    expect(rewriteTo(res)).toBeNull();
  });
});

describe("proxy — apex is marketing-only", () => {
  it("redirects a non-home apex path to the same path on app.<domain>", () => {
    const res = proxy(req("https://scan.to/signin"));
    expect(res.headers.get("location")).toBe("https://app.scan.to/signin");
  });

  it("redirects www the same as the bare apex", () => {
    const res = proxy(req("https://www.scan.to/pricing"));
    expect(res.headers.get("location")).toBe("https://app.scan.to/pricing");
  });

  it("does NOT redirect the apex homepage", () => {
    const res = proxy(req("https://scan.to/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("does not open-redirect off-domain via a double-slash path", () => {
    const res = proxy(req("https://scan.to//evil.com/phish"));
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    expect(new URL(location!).host).toBe("app.scan.to");
  });
});
