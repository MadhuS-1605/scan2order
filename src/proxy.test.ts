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
