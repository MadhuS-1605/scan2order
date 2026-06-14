import { NextResponse, type NextRequest } from "next/server";

// White-label resolver. In production, when a diner visits a restaurant's
// subdomain (e.g. spicegarden.scan.to/T1), rewrite it to the tenant route
// (/spicegarden/T1) which resolves the table. Locally (bare IP/host) the QR
// already uses the path form, so this is a no-op.
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";
const NON_TENANT = new Set(["www", "app", "admin", "api", "m", "t"]);

const TABLE_COOKIE = "sto_table";
const TABLE_COOKIE_MAX_AGE = 60 * 60 * 12; // a dining session (12h)

export function proxy(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").split(":")[0];
  const url = request.nextUrl;

  // Clean URLs: the QR resolves to /t/<token>[/order/...]; stash the table in a
  // cookie and redirect to the readable path (/menu, /order/<id>, .../bill) so
  // the opaque token never shows in the address bar.
  const tokenMatch = url.pathname.match(
    /^\/t\/([^/]+)((?:\/order\/[^/]+(?:\/bill)?)?)\/?$/,
  );
  if (tokenMatch) {
    const token = tokenMatch[1];
    const dest = tokenMatch[2] || "/menu";
    const res = NextResponse.redirect(new URL(dest + url.search, request.url));
    res.cookies.set(TABLE_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: TABLE_COOKIE_MAX_AGE,
    });
    return res;
  }

  if (host.endsWith("." + PLATFORM_DOMAIN)) {
    const sub = host.slice(0, host.length - PLATFORM_DOMAIN.length - 1);
    if (sub && !NON_TENANT.has(sub)) {
      // Staff sign in lives on the restaurant subdomain (e.g.
      // spicegarden.scan.to/signin) — resolve it to the scoped staff login.
      if (url.pathname === "/signin") {
        url.pathname = `/r/${sub}/signin`;
        return NextResponse.rewrite(url);
      }
      // Other single-segment paths on a restaurant subdomain map to /<sub>/<table>.
      if (/^\/[^/]+$/.test(url.pathname)) {
        url.pathname = `/${sub}${url.pathname}`;
        return NextResponse.rewrite(url);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
