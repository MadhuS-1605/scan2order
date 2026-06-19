import "server-only";
import { env } from "@/lib/env";
import { reportError } from "@/lib/observability";

// Cloudflare DNS automation for tenant subdomains. Instead of a single wildcard
// record (*.<domain>), each restaurant gets its own CNAME created here when its
// username is set, so subdomains are explicit + individually manageable.
//
// All calls are fail-soft: if Cloudflare is unconfigured or the API errors, we
// log via reportError and return { ok:false } — we never throw into onboarding
// or settings, so a DNS hiccup can't block a tenant from saving. The operations
// are idempotent, so re-saving the form safely retries.

const API = "https://api.cloudflare.com/client/v4";

export type DnsResult = { ok: boolean; skipped?: boolean; error?: string };

export function cloudflareConfigured(): boolean {
  return env.cloudflare.configured();
}

// Fully-qualified record name for a tenant username.
function fqdn(subdomain: string): string {
  return `${subdomain}.${env.platformDomain}`;
}

type CfResponse = { ok: boolean; result?: unknown; errors?: unknown };

async function cf(path: string, init?: RequestInit): Promise<CfResponse> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.cloudflare.apiToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    result?: unknown;
    errors?: unknown;
  };
  return {
    ok: res.ok && body.success !== false,
    result: body.result,
    errors: body.errors,
  };
}

// Look up an existing CNAME by name; returns its record id or null.
async function findRecordId(name: string): Promise<string | null> {
  const { ok, result } = await cf(
    `/zones/${env.cloudflare.zoneId}/dns_records?type=CNAME&name=${encodeURIComponent(name)}`,
  );
  if (!ok || !Array.isArray(result) || result.length === 0) return null;
  const first = result[0] as { id?: string };
  return first.id ?? null;
}

// Create (or update) the CNAME for a tenant subdomain. Idempotent.
export async function ensureSubdomain(subdomain: string): Promise<DnsResult> {
  if (!cloudflareConfigured()) return { ok: true, skipped: true };
  const name = fqdn(subdomain);
  const payload = {
    type: "CNAME",
    name,
    content: env.cloudflare.dnsTarget,
    proxied: env.cloudflare.proxied,
    ttl: 1, // "auto" — required when proxied
    comment: "scan-to-order tenant subdomain",
  };
  try {
    const id = await findRecordId(name);
    const r = id
      ? await cf(`/zones/${env.cloudflare.zoneId}/dns_records/${id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
      : await cf(`/zones/${env.cloudflare.zoneId}/dns_records`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
    if (!r.ok) {
      reportError("cloudflare.ensureSubdomain", new Error("Cloudflare API error"), {
        name,
        errors: r.errors,
      });
      return { ok: false, error: "DNS update failed" };
    }
    return { ok: true };
  } catch (e) {
    reportError("cloudflare.ensureSubdomain", e, { name });
    return { ok: false, error: "DNS request failed" };
  }
}

// Delete a tenant subdomain's CNAME (on rename/teardown). Idempotent — a missing
// record is treated as success.
export async function removeSubdomain(subdomain: string): Promise<DnsResult> {
  if (!cloudflareConfigured()) return { ok: true, skipped: true };
  const name = fqdn(subdomain);
  try {
    const id = await findRecordId(name);
    if (!id) return { ok: true };
    const r = await cf(`/zones/${env.cloudflare.zoneId}/dns_records/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      reportError("cloudflare.removeSubdomain", new Error("Cloudflare API error"), {
        name,
        errors: r.errors,
      });
      return { ok: false, error: "DNS delete failed" };
    }
    return { ok: true };
  } catch (e) {
    reportError("cloudflare.removeSubdomain", e, { name });
    return { ok: false, error: "DNS request failed" };
  }
}

// Reconcile a username change: drop the old record (if the name actually
// changed) and ensure the new one exists.
export async function syncSubdomain(
  previous: string | null | undefined,
  next: string,
): Promise<DnsResult> {
  if (previous && previous !== next) {
    await removeSubdomain(previous);
  }
  return ensureSubdomain(next);
}
