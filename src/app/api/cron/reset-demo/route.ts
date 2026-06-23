import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { seedDemoRestaurant } from "@/lib/demo/seed-demo";
import { reportError } from "@/lib/observability";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Nightly reset of the public sandbox/demo tenant ("Spice Garden (Demo)"): wipes
// whatever prospects changed during the day and rebuilds the known-good demo, so
// the demo is always fresh and can't be permanently broken. Point a Railway cron
// (or any scheduler) at this URL once a day with Authorization: Bearer <CRON_SECRET>.
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });
  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  try {
    const result = await seedDemoRestaurant(prisma);
    return Response.json({ ok: true, reset: "spice-garden-demo", ...result });
  } catch (e) {
    reportError("cron.resetDemo", e);
    return Response.json({ ok: false, error: "reset failed" }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
