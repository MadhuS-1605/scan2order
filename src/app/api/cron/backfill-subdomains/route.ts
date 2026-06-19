import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { ensureSubdomain, cloudflareConfigured } from "@/lib/cloudflare";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

// One-shot backfill: create the Cloudflare DNS record for every existing tenant
// that already has a username, so restaurants onboarded before the Cloudflare
// integration get their per-tenant CNAME without re-saving their profile.
//
// Idempotent — safe to re-run. Trigger once after deploy with the cron secret:
//   curl -X POST https://<app>/api/cron/backfill-subdomains \
//     -H "Authorization: Bearer $CRON_SECRET"
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const provided =
    auth.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("key") ||
    "";
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  if (!cloudflareConfigured())
    return new Response("Cloudflare not configured", { status: 503 });

  const restaurants = await prisma.restaurant.findMany({
    where: { subdomain: { not: null } },
    select: { id: true, subdomain: true },
  });

  let ensured = 0;
  const failed: string[] = [];
  for (const r of restaurants) {
    const sub = r.subdomain!;
    try {
      const res = await ensureSubdomain(sub);
      if (res.ok) ensured++;
      else failed.push(sub);
    } catch (e) {
      reportError("cron.backfill-subdomains", e, { restaurantId: r.id, subdomain: sub });
      failed.push(sub);
    }
  }

  return Response.json({
    ok: failed.length === 0,
    total: restaurants.length,
    ensured,
    failed,
  });
}

export const POST = handle;
export const GET = handle;
