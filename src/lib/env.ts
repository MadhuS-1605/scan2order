// Centralized, typed access to environment variables.
// Server-only values must never be imported into client components.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authSecret: () => required("AUTH_SECRET", process.env.AUTH_SECRET),

  // Apex domain tenant subdomains live under (<username>.<platformDomain>).
  // Mirrors the value the subdomain proxy + QR builder read.
  platformDomain: process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to",

  // Cloudflare DNS automation. When configured, each tenant gets an explicit
  // (proxied) CNAME created in the zone instead of relying on a wildcard record.
  // See src/lib/cloudflare.ts.
  cloudflare: {
    apiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
    zoneId: process.env.CLOUDFLARE_ZONE_ID ?? "",
    // What the per-tenant CNAME points at — the target Railway shows for the
    // service (e.g. "scan2order.up.railway.app").
    dnsTarget: process.env.CLOUDFLARE_DNS_TARGET ?? "",
    // Orange-cloud (Cloudflare-terminated TLS) by default; set "false" for
    // DNS-only / grey-cloud if Railway terminates TLS with a wildcard cert.
    proxied: process.env.CLOUDFLARE_PROXIED !== "false",
    configured: () =>
      Boolean(
        process.env.CLOUDFLARE_API_TOKEN &&
          process.env.CLOUDFLARE_ZONE_ID &&
          process.env.CLOUDFLARE_DNS_TARGET,
      ),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID ?? "",
    keySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    publicKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
    // Razorpay Subscription Plan IDs per tier (for auto-renew / eMandate). Create
    // these in the Razorpay dashboard; leave blank to keep pay-to-extend only.
    planIds: {
      STARTER: process.env.RAZORPAY_PLAN_STARTER ?? "",
      PRO: process.env.RAZORPAY_PLAN_PRO ?? "",
    } as Record<string, string>,
    configured: () =>
      Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  },

  // Shared secret guarding the scheduled cleanup endpoint (/api/cron/sweep).
  cronSecret: process.env.CRON_SECRET ?? "",

  // Sentry DSN for error reporting. When set, errors are forwarded to Sentry;
  // otherwise reportError just logs to stderr. No SDK dependency.
  sentryDsn: process.env.SENTRY_DSN ?? "",

  // Transactional email via Resend. Falls back to console logging when unset.
  // EMAIL_FROM defaults to Resend's shared test sender (works without a verified
  // domain); set a verified domain sender in production.
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    // Sender at the verified Resend domain (email.astechlabs.co.in). Override
    // the local-part/name via EMAIL_FROM.
    from: process.env.EMAIL_FROM ?? "Scan to Order <noreply@email.astechlabs.co.in>",
    configured: () => Boolean(process.env.RESEND_API_KEY),
  },

  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? "console") as
      | "console"
      | "twilio"
      | "meta",
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? "",
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? "",
    twilioWhatsappFrom: process.env.TWILIO_WHATSAPP_FROM ?? "",
    twilioSmsFrom: process.env.TWILIO_SMS_FROM ?? "",
    // Meta WhatsApp Cloud API (free Twilio alternative). Business-initiated
    // messages (OTP, bills) require pre-approved templates — set their names.
    meta: {
      token: process.env.META_WHATSAPP_TOKEN ?? "",
      phoneNumberId: process.env.META_WHATSAPP_PHONE_ID ?? "",
      apiVersion: process.env.META_WHATSAPP_API_VERSION ?? "v21.0",
      lang: process.env.META_WHATSAPP_LANG ?? "en",
      otpTemplate: process.env.META_WHATSAPP_OTP_TEMPLATE ?? "",
      billTemplate: process.env.META_WHATSAPP_BILL_TEMPLATE ?? "",
    },
  },
} as const;
