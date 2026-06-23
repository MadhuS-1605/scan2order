import type { NextConfig } from "next";
import os from "node:os";

// Every local network IPv4 of this machine, so the dev server is reachable
// (and trusted) from any device on the network without manual edits.
const localIPs = Object.values(os.networkInterfaces())
  .flat()
  .filter((n): n is os.NetworkInterfaceInfo => Boolean(n && n.family === "IPv4"))
  .map((n) => n.address);

const nextConfig: NextConfig = {
  images: {
    // Next.js 16: use remotePatterns (images.domains is deprecated).
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  // Trust this machine's IPs + private LAN ranges for cross-origin dev access.
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...localIPs,
    "10.*",
    "172.16.*",
    "192.168.*",
    "*.local",
  ],
  // Server-only packages that should not be bundled by Turbopack.
  serverExternalPackages: [
    "pdfkit",
    "@prisma/adapter-pg",
    "pg",
    "razorpay",
    "twilio",
    "web-push",
    "ioredis",
  ],
  async headers() {
    // Enforcing CSP. Razorpay Checkout pulls its SDK/iframe/XHR/fonts from
    // several *.razorpay.com subdomains (checkout, api, lumberjack, sentry,
    // cdn), so allow the whole suffix rather than enumerating each. Next's
    // hydration/runtime uses inline <script>/<style>, hence 'unsafe-inline'.
    // If Checkout ever errors on load, the first thing to try is adding
    // 'unsafe-eval' to script-src; to fully roll back, change the header key
    // below to "Content-Security-Policy-Report-Only".
    // Dev only: React + Turbopack use eval() in development for fast refresh and
    // callstack reconstruction, so 'unsafe-eval' is required locally. Production
    // React never uses eval(), so the prod policy stays strict (no eval).
    const devEval = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devEval} https://*.razorpay.com https://www.googletagmanager.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://*.razorpay.com",
      "connect-src 'self' https://*.razorpay.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com",
      "frame-src 'self' https://*.razorpay.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
