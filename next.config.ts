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
};

export default nextConfig;
