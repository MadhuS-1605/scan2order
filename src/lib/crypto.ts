import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { env } from "@/lib/env";

// AES-256-GCM encryption for secrets at rest (e.g. TOTP secrets). The env key is
// hashed to 32 bytes, so any-length key works. When no key is configured the
// value is stored/returned as-is (dev), and decrypt detects the format so a
// deployment can adopt a key without re-encrypting old rows by hand.

const PREFIX = "v1:";

function key(): Buffer | null {
  return env.encryptionKey ? createHash("sha256").update(env.encryptionKey).digest() : null;
}

export function encryptSecret(plain: string): string {
  const k = key();
  if (!k) {
    if (process.env.NODE_ENV === "production") {
      console.error("[crypto] ENCRYPTION_KEY is not set — storing a secret in PLAINTEXT.");
    }
    return plain; // unconfigured — store as-is
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legacy / plaintext
  const k = key();
  if (!k) return stored; // can't decrypt without the key
  const [, ivB, tagB, ctB] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64")), decipher.final()]).toString("utf8");
}
