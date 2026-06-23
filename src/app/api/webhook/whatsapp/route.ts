import crypto from "node:crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// Meta WhatsApp Cloud API inbound webhook.
//
// Purpose: whenever a diner messages the business number, Meta opens a 24-hour
// "customer service window" during which we may reply with FREE free-form
// messages (no template charge). We record when that window closes per customer
// so the bill step (src/lib/billing/actions.ts) can send the bill for free
// instead of paying for a utility template.
//
// Configure in the Meta app dashboard → WhatsApp → Configuration:
//   Callback URL = <app>/api/webhook/whatsapp
//   Verify token = META_WHATSAPP_VERIFY_TOKEN
//   App secret   = META_APP_SECRET (used to validate X-Hub-Signature-256)
//   Subscribe to the "messages" field.

const WINDOW_MS = 24 * 60 * 60 * 1000;

// GET: Meta's one-time verification handshake.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = env.messaging.meta.webhookVerifyToken;
  if (mode === "subscribe" && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

// Validates the X-Hub-Signature-256 header against the raw body using the app
// secret. When no app secret is configured we skip validation (dev/testing).
function validSignature(raw: string, signature: string | null): boolean {
  const secret = env.messaging.meta.appSecret;
  if (!secret) return true;
  if (!signature?.startsWith("sha256=")) return false;
  const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const expected = `sha256=${digest}`;
  // Constant-time compare; lengths must match for timingSafeEqual.
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// POST: inbound message notifications. We only care about extracting sender
// phone numbers to (re)open their 24h service window. Always 200 so Meta
// doesn't retry, even for payloads we ignore.
export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new Response("Invalid signature", { status: 401 });
  }

  let body: {
    entry?: {
      changes?: { value?: { messages?: { from?: string }[] } }[];
    }[];
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  // Collect every distinct sender across the batch.
  const senders = new Set<string>();
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const msg of change.value?.messages ?? []) {
        const digits = (msg.from ?? "").replace(/[^\d]/g, "");
        if (digits.length >= 7) senders.add(digits);
      }
    }
  }

  if (senders.size > 0) {
    const until = new Date(Date.now() + WINDOW_MS);
    // Phone formats vary (with/without country code or '+'), so match on the
    // trailing local digits. Only existing customers get a window — it's an
    // opportunistic, fail-soft optimisation.
    await Promise.all(
      [...senders].map((digits) =>
        prisma.customer.updateMany({
          where: { phone: { endsWith: digits.slice(-10) } },
          data: { whatsappWindowUntil: until },
        }),
      ),
    );
  }

  return new Response("ok", { status: 200 });
}
