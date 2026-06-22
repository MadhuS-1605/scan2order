import "server-only";
import { timingSafeEqual } from "node:crypto";

// Constant-time check of the cron bearer token. Header-only — never accept the
// secret in a query string (it would leak into access/proxy/CDN logs).
export function cronAuthorized(request: Request, secret: string): boolean {
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || provided.length !== secret.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    return false;
  }
}
