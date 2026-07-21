import "server-only";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

type WebhookConfig = { url?: string; secret?: string };

// Basic SSRF guard: only http(s), and reject obvious private/loopback/link-local
// targets so a webhook can't be pointed at internal services or cloud metadata.
// (Does not resolve DNS, so hostnames that rebind to private IPs are a residual
// risk — acceptable for this best-effort, settings-gated feature.)
export function isSafeWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h === "0.0.0.0") return false;
  if (h === "169.254.169.254") return false; // cloud metadata
  if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false;
  if (/^169\.254\./.test(h)) return false;
  if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return false;
  return true;
}

// Best-effort POST of an order event to the restaurant's configured webhook.
// Called fire-and-forget from the realtime bus, so failures never block a sale.
export async function dispatchWebhook(
  restaurantId: string,
  event: string,
  orderId?: string,
): Promise<void> {
  try {
    const integ = await prisma.integration.findUnique({
      where: { restaurantId_provider: { restaurantId, provider: "webhook" } },
    });
    if (!integ?.enabled) return;
    const cfg = (integ.config ?? {}) as WebhookConfig;
    if (!cfg.url || !isSafeWebhookUrl(cfg.url)) return;

    const payload = await buildPayload(event, restaurantId, orderId);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(cfg.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cfg.secret ? { "X-STO-Secret": cfg.secret } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // swallow — webhooks are best-effort
  }
}

async function buildPayload(event: string, restaurantId: string, orderId?: string) {
  const base = { event, restaurantId, at: new Date().toISOString() };
  if (!orderId) return base;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true, items: true },
  });
  if (!order) return base;
  return {
    ...base,
    order: {
      id: order.id,
      number: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      table: order.table?.label ?? null,
      customerName: order.customerName,
      total: toNumber(order.totalAmount),
      items: order.items.map((it) => ({
        name: it.nameSnapshot,
        quantity: it.quantity,
        lineTotal: toNumber(it.lineTotal),
      })),
    },
  };
}

// Send a sample payload so the operator can confirm their endpoint works.
export async function sendTestWebhook(
  url: string,
  secret?: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!isSafeWebhookUrl(url)) {
    return { ok: false, error: "URL must be a public http(s) endpoint." };
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-STO-Secret": secret } : {}),
        },
        body: JSON.stringify({
          event: "test.ping",
          at: new Date().toISOString(),
          message: "Hello from Scan2Order",
        }),
        signal: controller.signal,
      });
      return { ok: res.ok, status: res.status };
    } finally {
      clearTimeout(timer);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Request failed" };
  }
}
