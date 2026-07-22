import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { env } from "@/lib/env";

// Unguessable QR token (the sole secret gating diner bill/order access) —
// generate this for every RestaurantTable row rather than relying on the
// schema's id-style default, which isn't a CSPRNG.
export function newQrToken(): string {
  return randomBytes(24).toString("base64url");
}

// Public URL a diner lands on after scanning a table's QR code. Pass a base URL
// (from the current request host) so the QR works on the active network.
export function tableOrderUrl(qrToken: string, baseUrl?: string): string {
  const base = (baseUrl ?? env.appUrl).replace(/\/$/, "");
  return `${base}/t/${qrToken}`;
}

// Human-readable QR URL.
// - With a platform/custom domain: https://<username>.<domain>/<table>
// - On a bare IP/host (local dev): http://<host>/<username>/<table>
// Both resolve to the secure token internally.
export function tableMenuUrl(
  baseUrl: string,
  tenant: string,
  label: string,
): string {
  const base = baseUrl.replace(/\/$/, "");
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
  const tbl = encodeURIComponent(label);

  // When a real platform domain is configured, use the canonical subdomain form
  // (<username>.<domain>/<table>) regardless of which host the admin happened to
  // generate the QR on — a wildcard cert + per-tenant DNS makes every tenant
  // subdomain resolve. On a local/dev host (bare IP or localhost) fall back to
  // the path form so QR codes still work off-domain. Staging is a single
  // unified host (no per-tenant subdomain DNS — see cloudflareConfigured(),
  // which only ever creates those CNAMEs in real production), so it must also
  // use the path form or the QR points at a subdomain that never resolves.
  const host = base.replace(/^https?:\/\//, "");
  const isLocal =
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host) ||
    host.startsWith("localhost") ||
    host.endsWith(".local");
  if (platformDomain && !isLocal && env.appEnv === "production") {
    return `https://${tenant}.${platformDomain}/${tbl}`;
  }
  return `${base}/${tenant}/${tbl}`;
}

// Returns a PNG data URL for embedding/printing the QR code.
export function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1917", light: "#ffffff" },
  });
}
