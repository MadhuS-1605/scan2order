import QRCode from "qrcode";
import { env } from "@/lib/env";

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

  // If a real platform domain is configured (and we're not on a bare IP),
  // use the subdomain form. Otherwise use the path form (works on any host/IP).
  const host = base.replace(/^https?:\/\//, "");
  const isIp = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
  if (platformDomain && !isIp && host.includes(platformDomain)) {
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
