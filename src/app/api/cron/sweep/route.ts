import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { sweepStaleOrders } from "@/lib/orders/sweep";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

// Scheduled cleanup so the stale-order sweep runs even when no one has the admin
// orders board open. Point a Railway cron (or any scheduler) at this URL with
// Authorization: Bearer <CRON_SECRET> on a schedule (e.g. every 15 min).
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const provided =
    auth.replace(/^Bearer\s+/i, "") ||
    new URL(request.url).searchParams.get("key") ||
    "";
  if (provided !== secret) return new Response("Unauthorized", { status: 401 });

  const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
  let ok = 0;
  for (const r of restaurants) {
    try {
      await sweepStaleOrders(r.id);
      ok++;
    } catch (e) {
      reportError("cron.sweep", e, { restaurantId: r.id });
    }
  }
  return Response.json({ ok: true, swept: ok, total: restaurants.length });
}

export const POST = handle;
export const GET = handle;
