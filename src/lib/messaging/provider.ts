import "server-only";
import { env } from "@/lib/env";

// Messaging abstraction. Uses Twilio when configured, otherwise logs to the
// server console so the flow is fully testable without credentials.

type SendResult = { ok: boolean; error?: string; mocked?: boolean };

async function twilioClient() {
  const { default: twilio } = await import("twilio");
  return twilio(env.messaging.twilioAccountSid, env.messaging.twilioAuthToken);
}

const isTwilio = () =>
  env.messaging.provider === "twilio" &&
  env.messaging.twilioAccountSid &&
  env.messaging.twilioAuthToken;

// Transactional email via Resend's REST API (no SDK dependency). Logs to the
// console when no key is set, so the flow works in dev without credentials.
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<SendResult> {
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
      body: JSON.stringify({ from: env.email.from, to, subject, html }),
    });
    if (!res.ok) return { ok: false, error: `Email failed (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

export async function sendWhatsApp(
  to: string,
  body: string,
  fromOverride?: string | null,
): Promise<SendResult> {
  const from = fromOverride || env.messaging.twilioWhatsappFrom;
  if (!isTwilio() || !from) {
    console.log(`\n[WhatsApp → ${to}]\n${body}\n`);
    return { ok: true, mocked: true };
  }
  try {
    const client = await twilioClient();
    await client.messages.create({
      from: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
      to: to.startsWith("whatsapp:") ? to : `whatsapp:${to}`,
      body,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}

const isMeta = () =>
  env.messaging.provider === "meta" &&
  Boolean(env.messaging.meta.token && env.messaging.meta.phoneNumberId);

// Send a WhatsApp message via Meta's Cloud API using a pre-approved template
// (required for business-initiated messages like OTP / bills). `params` fill the
// template's body variables ({{1}}, {{2}}, …) in order. Logs to the console when
// Meta isn't configured, so the flow stays testable without credentials.
export async function sendWhatsAppTemplate(
  to: string,
  template: string,
  params: string[],
  lang: string = env.messaging.meta.lang,
): Promise<SendResult> {
  const m = env.messaging.meta;
  if (!isMeta() || !template) {
    console.log(`\n[WhatsApp template "${template}" → ${to}]\n${params.join(" | ")}\n`);
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
            components: params.length
              ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
              : [],
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

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!isTwilio() || !env.messaging.twilioSmsFrom) {
    console.log(`\n[SMS → ${to}]\n${body}\n`);
    return { ok: true, mocked: true };
  }
  try {
    const client = await twilioClient();
    await client.messages.create({
      from: env.messaging.twilioSmsFrom,
      to,
      body,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }
}
