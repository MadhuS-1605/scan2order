import "server-only";
import { createHmac, randomBytes } from "node:crypto";

// Minimal TOTP (RFC 6238, HMAC-SHA1, 6 digits, 30s step) + RFC 4648 base32,
// so authenticator apps (Google Authenticator, Authy, 1Password, …) work with
// no external dependency.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DIGITS = 6;
const STEP = 30;

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// New random base32 secret (160 bits, the TOTP recommendation).
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

function codeForStep(secret: Buffer, step: number): string {
  const counter = Buffer.alloc(8);
  // 32-bit hi is 0 for any realistic time; write the low 32 bits.
  counter.writeUInt32BE(Math.floor(step), 4);
  const hmac = createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (bin % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

// Returns the matched time-step (for replay tracking) or null. Allows ±`window`
// steps for clock drift.
export function verifyTotpStep(secretB32: string, token: string, window = 1): number | null {
  const t = (token ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return null;
  const secret = base32Decode(secretB32);
  const now = Math.floor(Date.now() / 1000 / STEP);
  for (let w = -window; w <= window; w++) {
    if (codeForStep(secret, now + w) === t) return now + w;
  }
  return null;
}

// Boolean convenience (enrolment confirm — no replay tracking needed there).
export function verifyTotp(secretB32: string, token: string, window = 1): boolean {
  return verifyTotpStep(secretB32, token, window) !== null;
}

// otpauth:// URI to render as a QR for authenticator-app enrolment.
export function totpUri(secret: string, account: string, issuer = "Scan2Order"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: "SHA1", digits: String(DIGITS), period: String(STEP) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
