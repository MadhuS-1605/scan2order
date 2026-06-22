import { env } from "@/lib/env";
import { runDailySummaries } from "@/lib/reports/daily";
import { reportError } from "@/lib/observability";
import { cronAuthorized } from "@/lib/cron-auth";

export const runtime = "nodejs";

// Scheduled end-of-day sales summary email to opted-in owners. Point a daily
// scheduler (early morning, after midnight in venue tz) at this URL with
// Authorization: Bearer <CRON_SECRET>.
async function handle(request: Request): Promise<Response> {
  const secret = env.cronSecret;
  if (!secret) return new Response("Cron not configured", { status: 503 });
  if (!cronAuthorized(request, secret)) return new Response("Unauthorized", { status: 401 });

  try {
    const { sent } = await runDailySummaries();
    return Response.json({ ok: true, sent });
  } catch (e) {
    reportError("cron.dailySummary", e);
    return new Response("Daily summary failed", { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
