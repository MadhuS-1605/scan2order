// Centralized, typed access to environment variables.
// Server-only values must never be imported into client components.

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  authSecret: () => {
    const s = required("AUTH_SECRET", process.env.AUTH_SECRET);
    // A weak secret makes session JWTs forgeable — require ≥32 chars.
    if (s.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters (generate with `openssl rand -base64 32`).");
    return s;
  },

  // Apex domain tenant subdomains live under (<username>.<platformDomain>).
  // Mirrors the value the subdomain proxy + QR builder read.
  platformDomain: process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to",

  // Google OAuth (owner "Continue with Google"). Optional — when unset, the
  // button is hidden and the routes return early. The redirect URI registered in
  // the Google console must be `${NEXT_PUBLIC_APP_URL}/api/auth/google/callback`.
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    configured: () =>
      Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },

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

  // GSTIN verification via Sandbox (api.sandbox.co.in). When configured, the
  // onboarding Settings step verifies a tenant's GSTIN against the GSTN and
  // auto-fills the registered legal name instead of trusting typed input.
  // Fail-soft: if unset or the API errors, the tenant can still save manually.
  // See src/lib/gst.ts.
  gst: {
    apiKey: process.env.SANDBOX_API_KEY ?? "",
    apiSecret: process.env.SANDBOX_API_SECRET ?? "",
    // Overridable in case Sandbox bumps the contract; defaults match their docs.
    baseUrl: process.env.SANDBOX_BASE_URL ?? "https://api.sandbox.co.in",
    apiVersion: process.env.SANDBOX_API_VERSION ?? "1.0",
    configured: () =>
      Boolean(process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET),
  },

  // Cloudflare R2 (S3-compatible) object storage for tenant image uploads (menu
  // photos, logos). Files are stored under a per-tenant key prefix and served
  // from the public CDN base URL. When unconfigured, the admin UI falls back to
  // pasting an external image URL. See src/lib/storage/r2.ts.
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
    // S3 API endpoint; defaults to the account R2 endpoint when only the id is set.
    endpoint:
      process.env.R2_ENDPOINT ??
      (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : ""),
    // Public CDN base (R2.dev URL or a custom domain) used to build stored URLs.
    publicBaseUrl: (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/$/, ""),
    configured: () =>
      Boolean(
        process.env.R2_ACCESS_KEY_ID &&
          process.env.R2_SECRET_ACCESS_KEY &&
          process.env.R2_BUCKET &&
          process.env.R2_PUBLIC_BASE_URL &&
          (process.env.R2_ENDPOINT || process.env.R2_ACCOUNT_ID),
      ),
  },

  // Platform (seller) identity printed on subscription tax invoices issued to
  // tenants. The charged amount is treated as GST-inclusive and decomposed on
  // the invoice. See src/lib/billing/invoice-pdf.ts.
  platform: {
    legalName: process.env.PLATFORM_LEGAL_NAME ?? "Scan to Order",
    gstin: process.env.PLATFORM_GSTIN ?? "",
    address: process.env.PLATFORM_ADDRESS ?? "",
    billingEmail: process.env.PLATFORM_BILLING_EMAIL ?? "",
  },

  // Operator alerting — where platform ops notices go (new signups, failures,
  // daily digest). Email via Resend and/or a Slack incoming webhook. See
  // src/lib/platform/alerts.ts.
  ops: {
    alertEmail: process.env.OPS_ALERT_EMAIL ?? "",
    slackWebhook: process.env.OPS_SLACK_WEBHOOK ?? "",
    configured: () => Boolean(process.env.OPS_ALERT_EMAIL || process.env.OPS_SLACK_WEBHOOK),
  },

  // Require an email OTP as a second factor for super-admin sign-in. Opt-in
  // (default off) so an unconfigured deployment can't lock out the operator.
  superAdmin2fa: process.env.SUPERADMIN_2FA === "true",

  // Secret used to encrypt sensitive values at rest (e.g. TOTP secrets). Any
  // string; hashed to a 32-byte key. When unset, those values are stored as-is.
  encryptionKey: process.env.ENCRYPTION_KEY ?? "",

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
      // Owner billing notices (see src/lib/billing/overage-notify.ts). Leave
      // blank to fall back to free-form (Twilio/console only).
      // Alert body params: {{1}} venue, {{2}} usage summary, {{3}} billing URL.
      overageAlertTemplate: process.env.META_WHATSAPP_OVERAGE_ALERT_TEMPLATE ?? "",
      // Paid body params: {{1}} venue, {{2}} amount, {{3}} billing URL.
      overagePaidTemplate: process.env.META_WHATSAPP_OVERAGE_PAID_TEMPLATE ?? "",
      // Dunning (trial-ending / lapsed). Body params: {{1}} venue, {{2}} message,
      // {{3}} billing URL.
      dunningTemplate: process.env.META_WHATSAPP_DUNNING_TEMPLATE ?? "",
    },
  },
} as const;
