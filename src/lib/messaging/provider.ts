import "server-only";
import { env } from "@/lib/env";
import { flagEnabled } from "@/lib/platform/flags";
import { prisma } from "@/lib/db";

// Messaging abstraction. WhatsApp goes through Meta's Cloud API (templates +
// in-window free-form); SMS OTP fallback uses 2Factor. Anything unconfigured
// logs to the server console so the flow is fully testable without credentials.

type SendResult = { ok: boolean; error?: string; mocked?: boolean };

// Every public send function below wraps its "Inner" implementation with this
// so every attempt is logged exactly once regardless of which internal return
// path fired — see src/app/superadmin/health for the aggregate failure rate.
async function logged(
  channel: "EMAIL" | "WHATSAPP" | "SMS",
  send: () => Promise<SendResult>,
): Promise<SendResult> {
  const result = await send();
  try {
    await prisma.messageDeliveryLog.create({
      data: { channel, ok: result.ok, mocked: Boolean(result.mocked), error: result.error ?? null },
    });
  } catch {
    // Never let logging break a send.
  }
  return result;
}

// Transactional email via Resend's REST API (no SDK dependency). Logs to the
// console when no key is set, so the flow works in dev without credentials.
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[],
): Promise<SendResult> {
  return logged("EMAIL", () => sendEmailInner(to, subject, html, attachments));
}

async function sendEmailInner(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer }[],
): Promise<SendResult> {
  if (!(await flagEnabled("email_enabled"))) return { ok: false, error: "Email sending is disabled." };
  if (!env.email.configured()) {
    console.log(`\n[Email → ${to}] ${subject}\n${html}\n`);
    return { ok: true, mocked: true };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.email.resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.email.from,
        to,
        subject,
        html,
        ...(attachments?.length
          ? { attachments: attachments.map((a) => ({ filename: a.filename, content: a.content.toString("base64") })) }
          : {}),
      }),
    });
    if (!res.ok) return { ok: false, error: `Email failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

// Free-form WhatsApp text. Meta business-initiated sends require a template
// (sendWhatsAppTemplate); in-window free-form is handled by sendWhatsAppFreeform.
// With no non-Meta provider, this logs to the console (dev / unconfigured).
export async function sendWhatsApp(
  to: string,
  body: string,
  fromOverride?: string | null,
): Promise<SendResult> {
  return logged("WHATSAPP", () => sendWhatsAppInner(to, body, fromOverride));
}

async function sendWhatsAppInner(
  to: string,
  body: string,
  _fromOverride?: string | null,
): Promise<SendResult> {
  if (!(await flagEnabled("whatsapp_enabled"))) return { ok: false, error: "WhatsApp sending is disabled." };
  console.log(`\n[WhatsApp → ${to}]\n${body}\n`);
  return { ok: true, mocked: true };
}

const isMeta = () =>
  env.messaging.provider === "meta" &&
  Boolean(env.messaging.meta.token && env.messaging.meta.phoneNumberId);

// Body parameters can be positional (Meta's classic {{1}}, {{2}}, … templates —
// pass plain strings, filled in array order) or named (newer templates authored
// with {{customer_name}}-style placeholders in Meta's template composer — pass
// {name, value} pairs; Meta requires a matching `parameter_name` per parameter
// for these, not positional order).
type TemplateParam = string | { name: string; value: string };

function bodyParameter(p: TemplateParam): Record<string, string> {
  return typeof p === "string"
    ? { type: "text", text: p }
    : { type: "text", parameter_name: p.name, text: p.value };
}

// Send a WhatsApp message via Meta's Cloud API using a pre-approved template
// (required for business-initiated messages like OTP / bills). `params` fill the
// template's body variables — see TemplateParam above for positional vs named.
// `headerDocument`, when given, fills a template's Document header (e.g. the
// "Receipt attachment" library template) — Meta fetches the PDF from `link` at
// send time. Logs to the console when Meta isn't configured, so the flow stays
// testable without credentials.
export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  params: TemplateParam[],
  lang: string = env.messaging.meta.lang,
  headerDocument?: { link: string; filename: string },
): Promise<SendResult> {
  return logged("WHATSAPP", () => sendWhatsAppTemplateInner(to, template, params, lang, headerDocument));
}

async function sendWhatsAppTemplateInner(
  to: string,
  template: string,
  params: TemplateParam[],
  lang: string,
  headerDocument?: { link: string; filename: string },
): Promise<SendResult> {
  if (!(await flagEnabled("whatsapp_enabled"))) return { ok: false, error: "WhatsApp sending is disabled." };
  const m = env.messaging.meta;
  if (!isMeta() || !template) {
    const paramsText = params
      .map((p) => (typeof p === "string" ? p : `${p.name}=${p.value}`))
      .join(" | ");
    console.log(
      `\n[WhatsApp template "${template}" → ${to}]\n${paramsText}` +
        `${headerDocument ? `\n[attachment] ${headerDocument.filename} — ${headerDocument.link}` : ""}\n`,
    );
    return { ok: true, mocked: true };
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${m.apiVersion}/${m.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${m.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[^\d]/g, ""), // E.164 digits, country code, no '+'
          type: "template",
          template: {
            name: template,
            language: { code: lang },
            components: [
              ...(headerDocument
                ? [
                    {
                      type: "header",
                      parameters: [
                        {
                          type: "document",
                          document: { link: headerDocument.link, filename: headerDocument.filename },
                        },
                      ],
                    },
                  ]
                : []),
              ...(params.length
                ? [{ type: "body", parameters: params.map(bodyParameter) }]
                : []),
            ],
          },
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp failed (${res.status})${txt ? `: ${txt.slice(0, 160)}` : ""}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

// Send a free-form WhatsApp text (NOT a template). Meta only delivers this
// inside an open 24-hour customer service window (the recipient messaged the
// business in the last 24h); outside it Meta rejects with error 131047/470 and
// the caller must fall back to a paid template. A session message is FREE, so
// bills sent this way carry no per-message charge. Without Meta this is a no-op
// console log.
export async function sendWhatsAppFreeform(
  to: string,
  body: string,
  fromOverride?: string | null,
): Promise<SendResult> {
  return logged("WHATSAPP", () => sendWhatsAppFreeformInner(to, body, fromOverride));
}

async function sendWhatsAppFreeformInner(
  to: string,
  body: string,
  fromOverride?: string | null,
): Promise<SendResult> {
  if (!(await flagEnabled("whatsapp_enabled"))) return { ok: false, error: "WhatsApp sending is disabled." };
  if (!isMeta()) return sendWhatsAppInner(to, body, fromOverride);
  const m = env.messaging.meta;
  try {
    const res = await fetch(
      `https://graph.facebook.com/${m.apiVersion}/${m.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${m.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/[^\d]/g, ""),
          type: "text",
          text: { body, preview_url: true },
        }),
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, error: `WhatsApp session send failed (${res.status})${txt ? `: ${txt.slice(0, 160)}` : ""}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

// Low-cost SMS fallback for OTP delivery, used only when the primary WhatsApp
// send fails (e.g. the recipient isn't on WhatsApp). Sends our own `code` via
// 2Factor.in's transactional SMS route (cheapest for India). Logs to the
// console (mocked) when no fallback provider is configured.
export async function sendOtpSms(to: string, code: string): Promise<SendResult> {
  return logged("SMS", () => sendOtpSmsInner(to, code));
}

async function sendOtpSmsInner(to: string, code: string): Promise<SendResult> {
  const fb = env.messaging.smsFallback;
  const phone = to.replace(/[^\d]/g, "");
  if (fb.provider === "twofactor" && fb.twoFactorApiKey) {
    try {
      // 2Factor "SMS" endpoint injects our code into an approved template:
      // /API/V1/{key}/SMS/{phone}/{otp}[/{template}]
      const tmpl = fb.twoFactorTemplate ? `/${encodeURIComponent(fb.twoFactorTemplate)}` : "";
      const res = await fetch(
        `https://2factor.in/API/V1/${fb.twoFactorApiKey}/SMS/${phone}/${encodeURIComponent(code)}${tmpl}`,
      );
      const j = (await res.json().catch(() => null)) as { Status?: string; Details?: string } | null;
      if (!res.ok || j?.Status !== "Success") {
        return { ok: false, error: `SMS failed${j?.Details ? `: ${j.Details}` : ` (${res.status})`}` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "SMS send failed" };
    }
  }
  console.log(`\n[SMS fallback → ${to}] code ${code}\n`);
  return { ok: true, mocked: true };
}
