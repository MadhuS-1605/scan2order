import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";

// Minimal structured error reporting. Always writes a JSON line to stderr (which
// Railway/most hosts capture). When SENTRY_DSN is set, it ALSO forwards the
// event to Sentry's ingestion endpoint — no @sentry SDK dependency.
export function reportError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): void {
  const e =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) };
  try {
    console.error(
      JSON.stringify({ level: "error", context, ...e, ...extra, at: new Date().toISOString() }),
    );
  } catch {
    console.error("[reportError]", context, e);
  }
  // Fire-and-forget Sentry forward; never throws into the caller.
  if (env.sentryDsn) void forwardToSentry(context, e, extra);
}

// Parse a Sentry DSN: https://<publicKey>@<host>/<projectId>
function parseDsn(dsn: string): { url: string; publicKey: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return {
      url: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      publicKey: u.username,
    };
  } catch {
    return null;
  }
}

async function forwardToSentry(
  context: string,
  e: { name?: string; message: string; stack?: string },
  extra?: Record<string, unknown>,
): Promise<void> {
  const dsn = parseDsn(env.sentryDsn);
  if (!dsn) return;
  try {
    await fetch(dsn.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=scan2order/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: JSON.stringify({
        event_id: randomUUID().replace(/-/g, ""),
        timestamp: new Date().toISOString(),
        platform: "node",
        level: "error",
        logger: context,
        exception: {
          values: [
            {
              type: e.name ?? "Error",
              value: e.message,
              ...(e.stack ? { stacktrace: { frames: [] } } : {}),
            },
          ],
        },
        extra: { ...extra, stack: e.stack },
      }),
    });
  } catch {
    // best-effort; the stderr log above is the durable record
  }
}
