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
