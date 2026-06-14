import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

// The base URL the current request came in on (e.g. http://192.168.29.26:3000),
// so QR codes / links use whatever host the restaurant is actually using —
// falling back to NEXT_PUBLIC_APP_URL when the host header is unavailable.
export async function getBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return env.appUrl.replace(/\/$/, "");
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "http");
  return `${proto}://${host}`;
}
