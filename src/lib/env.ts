// Centralized, typed access to environment variables.
// Server-only values must never be imported into client components.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authSecret: () => required("AUTH_SECRET", process.env.AUTH_SECRET),

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    publicKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
    configured: () =>
      Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  },

  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? "console") as
      | "console"
      | "twilio",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
    twilioSmsFrom: process.env.TWILIO_SMS_FROM ?? "",
  },
} as const;
