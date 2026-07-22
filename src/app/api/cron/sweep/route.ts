import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { sweepStaleOrders } from "@/lib/orders/sweep";
import { reportError } from "@/lib/observability";
import { notifyOps } from "@/lib/platform/alerts";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";

// Scheduled cleanup so the stale-order sweep runs even when no one has the admin
// orders board open. Point a Railway cron (or any scheduler) at this URL with
// Authorization: Bearer <CRON_SECRET> on a schedule (e.g. every 15 min).
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });

  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  const restaurants = await prisma.restaurant.findMany({ select: { id: true } });
  let ok = 0;
  const failed: string[] = [];
  for (const r of restaurants) {
    try {
      await sweepStaleOrders(r.id);
      ok++;
    } catch (e) {
      reportError("cron.sweep", e, { restaurantId: r.id });
      failed.push(r.id);
    }
  }
  // One summary alert rather than one per restaurant — a sweep failure means
  // this tenant's stuck payment intents/abandoned orders won't self-heal.
  if (failed.length) {
    await notifyOps(
      "Order sweep failed for some restaurants",
      `${failed.length}/${restaurants.length} restaurant sweeps threw: ${failed.join(", ")}`,
    );
  }
  return Response.json({ ok: true, swept: ok, total: restaurants.length });
}

export const POST = handle;
export const GET = handle;
