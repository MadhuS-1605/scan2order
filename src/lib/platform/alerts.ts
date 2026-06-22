import "server-only";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/messaging/provider";
import { reportError } from "@/lib/observability";

// Operator (platform team) alerts — email + optional Slack webhook. Fail-soft:
// an alert problem must never break the action that triggered it. No-op when
// ops alerting isn't configured.
export async function notifyOps(subject: string, text: string): Promise<void> {
  if (!env.ops.configured()) return;
  try {
    if (env.ops.alertEmail) {
      const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
        <h3 style="margin:0 0 8px">${subject}</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;color:#333;margin:0">${text}</pre>
      </div>`;
      await sendEmail(env.ops.alertEmail, `[Ops] ${subject}`, html);
    }
    if (env.ops.slackWebhook) {
      await fetch(env.ops.slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${subject}*\n${text}` }),
        cache: "no-store",
      });
    }
  } catch (e) {
    reportError("ops.notify", e, { subject });
  }
}
