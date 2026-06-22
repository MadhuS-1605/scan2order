import "server-only";
import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";
import { env } from "@/lib/env";
import { reportError } from "@/lib/observability";

// Tenant image uploads to Cloudflare R2 (S3-compatible). Each tenant gets its own
// key prefix; the stored value is the public CDN URL. Fail-soft: when R2 isn't
// configured the admin UI falls back to pasting an external image URL.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed content types → file extension.
const EXT_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function r2Configured(): boolean {
  return env.r2.configured();
}

// Detect the real image type from magic bytes (returns null if not a known image).
function sniffImageType(buf: ArrayBuffer): string | null {
  const b = new Uint8Array(buf.slice(0, 12));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return "image/webp";
  return null;
}

let client: AwsClient | null = null;
function r2(): AwsClient {
  if (!client) {
    client = new AwsClient({
      accessKeyId: env.r2.accessKeyId,
      secretAccessKey: env.r2.secretAccessKey,
      region: "auto",
      service: "s3",
    });
  }
  return client;
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

// Upload bytes under `<folder>/<kind>/<random>.<ext>` and return the CDN URL.
export async function uploadTenantImage(opts: {
  folder: string; // per-tenant prefix, e.g. "tenants/<restaurantId>"
  kind: string; // "menu" | "logo" | "misc"
  bytes: ArrayBuffer;
  contentType: string; // client-declared (advisory only — we sniff the bytes)
}): Promise<UploadResult> {
  if (!r2Configured()) return { ok: false, error: "Image uploads aren't set up. Paste an image URL instead." };
  if (opts.bytes.byteLength > MAX_UPLOAD_BYTES) return { ok: false, error: "Image is too large (max 5 MB)." };
  // Trust the file's MAGIC BYTES, not the client-supplied MIME — prevents
  // uploading HTML/SVG/script bytes under an image/* label (stored XSS via CDN).
  const sniffed = sniffImageType(opts.bytes);
  if (!sniffed) return { ok: false, error: "Use a real PNG, JPG, WebP or GIF image." };
  const ext = EXT_BY_TYPE[sniffed];

  const key = `${opts.folder}/${opts.kind}/${randomUUID()}.${ext}`;
  try {
    const res = await r2().fetch(`${env.r2.endpoint}/${env.r2.bucket}/${key}`, {
      method: "PUT",
      headers: { "content-type": sniffed, "x-amz-meta-sniffed": "1" },
      body: opts.bytes,
    });
    if (!res.ok) {
      reportError("r2.upload", new Error(`status ${res.status}`), { key });
      return { ok: false, error: "Upload failed. Please try again." };
    }
    return { ok: true, url: `${env.r2.publicBaseUrl}/${key}` };
  } catch (e) {
    reportError("r2.upload", e, { key });
    return { ok: false, error: "Upload failed. Please try again." };
  }
}
