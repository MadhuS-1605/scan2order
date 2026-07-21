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

  // In local dev (NODE_ENV=development, i.e. `next dev`), prefer RAZORPAY_TEST_*
  // over the live RAZORPAY_* vars when both are set — so local work never
  // touches the live platform Razorpay account. `next build`/`next start`
  // always run with NODE_ENV=production, so this fallback never applies to a
  // real deployment regardless of what's in its env. Per-tenant keys (Settings
  // → Payment & messaging) are separate and unaffected by this.
  razorpay: (() => {
    const useTest = process.env.NODE_ENV === "development";
    const keyId = (useTest && process.env.RAZORPAY_TEST_KEY_ID) || process.env.RAZORPAY_KEY_ID || "";
    const keySecret =
      (useTest && process.env.RAZORPAY_TEST_KEY_SECRET) || process.env.RAZORPAY_KEY_SECRET || "";
    const publicKeyId =
      (useTest && process.env.NEXT_PUBLIC_RAZORPAY_TEST_KEY_ID) ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      "";
    return {
      keyId,
      keySecret,
      publicKeyId,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
      // Razorpay Subscription Plan IDs per tier (for auto-renew / eMandate).
      // Create these in the Razorpay dashboard; leave blank to keep
      // pay-to-extend only.
      planIds: {
        STARTER: process.env.RAZORPAY_PLAN_STARTER ?? "",
        PRO: process.env.RAZORPAY_PLAN_PRO ?? "",
      } as Record<string, string>,
      configured: () => Boolean(keyId && keySecret),
    };
  })(),

  // GSTIN verification via Sandbox (api.sandbox.co.in). When configured, the
  // onboarding Settings step verifies a tenant's GSTIN against the GSTN and
  // auto-fills the registered legal name instead of trusting typed input.
  // Fail-soft: if unset or the API errors, the tenant can still save manually.
  // See src/lib/gst.ts. Same local-dev test-credential fallback as Razorpay
  // above — SANDBOX_TEST_* (including a separate test host) takes priority
  // when NODE_ENV=development; never applies to a built deployment.
  gst: (() => {
    const useTest = process.env.NODE_ENV === "development";
    const apiKey = (useTest && process.env.SANDBOX_TEST_API_KEY) || process.env.SANDBOX_API_KEY || "";
    const apiSecret =
      (useTest && process.env.SANDBOX_TEST_API_SECRET) || process.env.SANDBOX_API_SECRET || "";
    // Overridable in case Sandbox bumps the contract; defaults match their docs.
    const baseUrl =
      (useTest && process.env.SANDBOX_TEST_BASE_URL) ||
      process.env.SANDBOX_BASE_URL ||
      "https://api.sandbox.co.in";
    return {
      apiKey,
      apiSecret,
      baseUrl,
      apiVersion: process.env.SANDBOX_API_VERSION ?? "1.0",
      configured: () => Boolean(apiKey && apiSecret),
    };
  })(),

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
  // The default below requires email.scan2order.co.in to be a verified
  // sending domain in Resend (Domains -> Add Domain) — set EMAIL_FROM to
  // override, or to Resend's no-verification test sender
  // (onboarding@resend.dev) while you don't have a domain verified yet.
  email: {
    resendApiKey: process.env.RESEND_API_KEY ?? "",
    from: process.env.EMAIL_FROM ?? "Scan to Order <noreply@email.scan2order.co.in>",
    configured: () => Boolean(process.env.RESEND_API_KEY),
  },

  messaging: {
    provider: (process.env.MESSAGING_PROVIDER ?? "console") as
      | "console"
      | "meta",
    // Meta WhatsApp Cloud API. Business-initiated messages (OTP, bills) require
    // pre-approved templates — set their names.
    meta: {
      token: process.env.META_WHATSAPP_TOKEN ?? "",
      phoneNumberId: process.env.META_WHATSAPP_PHONE_ID ?? "",
      apiVersion: process.env.META_WHATSAPP_API_VERSION ?? "v21.0",
      lang: process.env.META_WHATSAPP_LANG ?? "en",
      otpTemplate: process.env.META_WHATSAPP_OTP_TEMPLATE ?? "",
      billTemplate: process.env.META_WHATSAPP_BILL_TEMPLATE ?? "",
      // Owner billing notices (see src/lib/billing/overage-notify.ts). Leave
      // blank to fall back to a free-form/console send.
      // Alert body params: {{1}} venue, {{2}} usage summary, {{3}} billing URL.
      overageAlertTemplate: process.env.META_WHATSAPP_OVERAGE_ALERT_TEMPLATE ?? "",
      // Paid body params: {{1}} venue, {{2}} amount, {{3}} billing URL.
      overagePaidTemplate: process.env.META_WHATSAPP_OVERAGE_PAID_TEMPLATE ?? "",
      // Dunning (trial-ending / lapsed). Body params: {{1}} venue, {{2}} message,
      // {{3}} billing URL.
      dunningTemplate: process.env.META_WHATSAPP_DUNNING_TEMPLATE ?? "",
      // Inbound webhook (src/app/api/webhook/whatsapp). The verify token is the
      // string you set in the Meta webhook config; the app secret is used to
      // validate the X-Hub-Signature-256 of inbound payloads. Inbound messages
      // open a 24h customer service window, during which bills can be sent as
      // free-form session messages for free (no utility-template charge).
      webhookVerifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN ?? "",
      appSecret: process.env.META_APP_SECRET ?? "",
    },
    // Low-cost SMS fallback for OTP delivery when the primary WhatsApp send
    // fails (e.g. the number isn't on WhatsApp). 2Factor.in is the cheapest
    // route for India (~₹0.15/OTP) and sends our own code via an approved
    // template. provider="none" disables the fallback (default).
    smsFallback: {
      provider: (process.env.SMS_FALLBACK_PROVIDER ?? "none") as "none" | "twofactor",
      twoFactorApiKey: process.env.TWOFACTOR_API_KEY ?? "",
      // Optional approved DLT template name registered in the 2Factor dashboard.
      twoFactorTemplate: process.env.TWOFACTOR_TEMPLATE ?? "",
    },
  },
} as const;
