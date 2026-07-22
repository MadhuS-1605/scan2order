import { env } from "@/lib/env";
import { runDunning } from "@/lib/billing/dunning";
import { reportError } from "@/lib/observability";
import { notifyOps } from "@/lib/platform/alerts";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";

// Scheduled dunning: nudge owners whose trial/plan is ending or just lapsed.
// Point a scheduler at this URL with Authorization: Bearer <CRON_SECRET>, daily.
// A per-restaurant cooldown means running it more often is harmless.
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });

  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  try {
    const { notified } = await runDunning();
    return Response.json({ ok: true, notified });
  } catch (e) {
    reportError("cron.dunning", e);
    await notifyOps("Dunning cron failed", `The dunning run itself failed (not a single owner's notice — the whole run): ${e instanceof Error ? e.message : String(e)}`);
    return new Response("Dunning failed", { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
