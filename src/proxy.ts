import { NextResponse, type NextRequest } from "next/server";

// White-label resolver. In production, when a diner visits a restaurant's
// subdomain (e.g. spicegarden.scan.to/T1), rewrite it to the tenant route
// (/spicegarden/T1) which resolves the table. Locally (bare IP/host) the QR
// already uses the path form, so this is a no-op.
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";
const NON_TENANT = new Set(["www", "app", "admin", "api", "m", "t", "staging-app"]);

// Single-segment app routes that must NOT be treated as a table label. On a
// tenant subdomain only the QR's table path (e.g. /T1) is rewritten to
// /<sub>/<table>; everything else here is a real diner/app page that the table
// cookie already scopes (set when /t/<token> was visited), so it passes through.
// Without this, e.g. /menu would be rewritten to /<sub>/menu and 404.
const RESERVED_PATHS = new Set([
  "menu",
  "cart",
  "checkout",
  "payment",
  "order",
  "account",
  "banquet",
  "book",
  "offline",
  "onboarding",
  "signup",
  "superadmin",
  "admin",
  "api",
  "t",
  "privacy",
  "terms",
]);

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
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TABLE_COOKIE_MAX_AGE,
    });
    return res;
  }

  // The apex (and www) domain is marketing-only: just the homepage. Every
  // other path — signin, signup, admin, superadmin, privacy, etc. — lives on
  // app.<domain> (see NON_TENANT above and src/app/page.tsx's APP_URL links).
  const isMarketingHost = host === PLATFORM_DOMAIN || host === `www.${PLATFORM_DOMAIN}`;
  if (isMarketingHost && url.pathname !== "/") {
    // A pathname starting with "//" is parsed by URL() as a scheme-relative
    // authority, replacing the destination's host — collapse leading slashes
    // to one first or "scan2order.co.in//evil.com" open-redirects off-domain.
    const safePath = "/" + url.pathname.replace(/^\/+/, "");
    const dest = new URL(safePath + url.search, `https://app.${PLATFORM_DOMAIN}`);
    return NextResponse.redirect(dest, 308);
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
      // A single-segment path that isn't a reserved app route is a table label
      // (the QR landing, e.g. /T1) → map it to /<sub>/<table>. Reserved routes
      // (/menu, /cart, ...) fall through and serve normally.
      const seg = url.pathname.slice(1);
      if (/^[^/]+$/.test(seg) && !RESERVED_PATHS.has(seg.toLowerCase())) {
        url.pathname = `/${sub}/${seg}`;
        return NextResponse.rewrite(url);
      }
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
