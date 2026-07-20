# Environment variables

Every environment variable the project reads, what it does, whether it's
required, and **how to obtain it**. Most live in `src/lib/env.ts` (the typed
accessor); a few infra ones are read directly (`DATABASE_URL`, VAPID, Redis).

**Legend:** 🔴 required to run · 🟡 required for that feature · ⚪ optional.
`NEXT_PUBLIC_*` vars are exposed to the browser — never put secrets in them.

---

## Core (app won't work without these)

| Key | Req | What / how to get it |
|---|---|---|
| `DATABASE_URL` | 🔴 | PostgreSQL connection string. From your DB host (Railway/Neon/Supabase/RDS) or local: `postgresql://user:pass@localhost:5432/scan_to_order`. |
| `AUTH_SECRET` | 🔴 | Signs session JWTs. Generate: `openssl rand -base64 32`. Keep stable (rotating logs everyone out). |
| `NEXT_PUBLIC_APP_URL` | 🟡 | Public base URL, e.g. `https://app.yourdomain.com`. Defaults to `http://localhost:3000`. Used in emails/links/QR. |
| `NEXT_PUBLIC_PLATFORM_DOMAIN` | 🟡 | Apex domain tenant subdomains live under (`<venue>.<domain>`). Defaults to `scan.to`. Set to the domain you own. |
| `NODE_ENV` | ⚪ | `production` in prod (set by the platform). Gates dev-only mock payment paths. |
| `PORT` | ⚪ | Server port (set by the host; defaults to 3000). |
| `ENCRYPTION_KEY` | 🟡 | Encrypts secrets at rest (TOTP). Any string — `openssl rand -base64 32`. Without it those values are stored as plaintext. Don't lose it (encrypted data becomes unrecoverable). |
| `CRON_SECRET` | 🟡 | Bearer token guarding the cron endpoints (`/api/cron/*`). Generate: `openssl rand -hex 24`. Put the same value in your scheduler's `Authorization: Bearer …` header. |

## Payments — Razorpay
Sign up at **dashboard.razorpay.com** → Settings → API Keys.

| Key | Req | What / how to get it |
|---|---|---|
| `RAZORPAY_KEY_ID` | 🟡 | API key id (`rzp_live_…` / `rzp_test_…`). Dashboard → API Keys → Generate. |
| `RAZORPAY_KEY_SECRET` | 🟡 | API key secret (shown once at generation). |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | 🟡 | Same key id, exposed to the browser checkout. (Public — id only, never the secret.) |
| `RAZORPAY_WEBHOOK_SECRET` | 🟡 | Dashboard → Settings → Webhooks → add `…/api/webhook/razorpay`, events `payment.captured`, `order.paid`, `subscription.*`; set + copy the signing secret. |
| `RAZORPAY_PLAN_STARTER` | ⚪ | Subscription Plan id for auto-renew (Starter). Dashboard → Subscriptions → Plans. Blank = pay-to-extend only. |
| `RAZORPAY_PLAN_PRO` | ⚪ | Same, for Pro. |

## Email — Resend
Create an account at **resend.com**.

| Key | Req | What / how to get it |
|---|---|---|
| `RESEND_API_KEY` | 🟡 | Resend → API Keys → Create. Without it, emails are logged to the console (dev). |
| `EMAIL_FROM` | ⚪ | Sender, e.g. `Scan to Order <noreply@yourdomain.com>`. Verify the domain in Resend → Domains first. Has a default test sender. |

## WhatsApp & SMS
Pick a provider with `MESSAGING_PROVIDER`. `console` (default) just logs — fine for dev.

| Key | Req | What / how to get it |
|---|---|---|
| `MESSAGING_PROVIDER` | ⚪ | `console` \| `meta`. Default `console`. |
| `SMS_FALLBACK_PROVIDER` | ⚪ | `none` \| `twofactor`. SMS OTP fallback when WhatsApp can't deliver. |
| `TWOFACTOR_API_KEY` | 🟡* | 2Factor.in dashboard → API key. *If `SMS_FALLBACK_PROVIDER=twofactor`. |
| `TWOFACTOR_TEMPLATE` | ⚪ | Optional approved 2Factor SMS template name. |
| `META_WHATSAPP_TOKEN` | 🟡* | Meta WhatsApp Cloud API token. developers.facebook.com → your app → WhatsApp → API Setup. *If provider=meta. |
| `META_WHATSAPP_PHONE_ID` | 🟡* | Phone number ID from the same WhatsApp API Setup page. |
| `META_WHATSAPP_API_VERSION` | ⚪ | Graph API version, default `v21.0`. |
| `META_WHATSAPP_LANG` | ⚪ | Template language code, default `en`. |
| `META_WHATSAPP_OTP_TEMPLATE` | 🟡* | Approved template name for bill-OTP (body var `{{1}}`=code). Meta → WhatsApp → Message Templates. |
| `META_WHATSAPP_BILL_TEMPLATE` | 🟡* | Approved template for the bill — Document header (the bill PDF) + named body vars `{{name}}` (venue) and `{{amount}}` (bare number, no currency code — bake the symbol into the template text). Meta's "Receipt attachment" library template (category Utility) uses this shape. |
| `META_WHATSAPP_OVERAGE_ALERT_TEMPLATE` | ⚪ | Owner usage-alert template ({{1}} venue, {{2}} usage, {{3}} URL). Blank = free-form fallback. |
| `META_WHATSAPP_OVERAGE_PAID_TEMPLATE` | ⚪ | Overage-paid receipt template ({{1}} venue, {{2}} amount, {{3}} URL). |
| `META_WHATSAPP_DUNNING_TEMPLATE` | ⚪ | Trial-ending / lapsed reminder template ({{1}} venue, {{2}} message, {{3}} URL). |

## Image storage — Cloudflare R2
Cloudflare dash → **R2** → create a bucket; → Manage R2 API Tokens → create an Access Key.

| Key | Req | What / how to get it |
|---|---|---|
| `R2_ACCOUNT_ID` | 🟡 | Cloudflare account ID (R2 overview / dashboard URL). Used to derive the S3 endpoint. |
| `R2_ACCESS_KEY_ID` | 🟡 | From the R2 API token you create. |
| `R2_SECRET_ACCESS_KEY` | 🟡 | Shown once when creating the R2 API token. |
| `R2_BUCKET` | 🟡 | The bucket name you created. |
| `R2_PUBLIC_BASE_URL` | 🟡 | Public URL serving the bucket — enable the R2.dev domain or attach a custom domain (R2 → Settings → Public access). e.g. `https://images.yourdomain.com`. |
| `R2_ENDPOINT` | ⚪ | Override the S3 endpoint; defaults to `https://<account>.r2.cloudflarestorage.com`. |

> Without R2, image fields fall back to pasting an external URL — nothing breaks.

## Subdomain DNS — Cloudflare
Cloudflare dash for the zone of `NEXT_PUBLIC_PLATFORM_DOMAIN`.

| Key | Req | What / how to get it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ⚪ | My Profile → API Tokens → create a token with **Zone → DNS → Edit** on your zone. |
| `CLOUDFLARE_ZONE_ID` | ⚪ | Zone overview page (right sidebar) for your domain. |
| `CLOUDFLARE_DNS_TARGET` | ⚪ | What each tenant CNAME points at, e.g. your Railway target `scan2order.up.railway.app`. |
| `CLOUDFLARE_PROXIED` | ⚪ | `false` for DNS-only (grey-cloud); anything else = proxied. Default proxied. |

> Without these, per-tenant subdomains aren't auto-provisioned (use a wildcard DNS record instead).

## GSTIN verification — Sandbox
Sign up at **api.sandbox.co.in** (India KYC/GST APIs).

| Key | Req | What / how to get it |
|---|---|---|
| `SANDBOX_API_KEY` | ⚪ | Sandbox dashboard → API credentials. |
| `SANDBOX_API_SECRET` | ⚪ | Same. |
| `SANDBOX_BASE_URL` | ⚪ | Defaults to `https://api.sandbox.co.in`. |
| `SANDBOX_API_VERSION` | ⚪ | Defaults to `1.0`. |

> Without these, the onboarding GSTIN field still works — it just isn't auto-verified.

## Platform tax-invoice identity (your company, the seller)

| Key | Req | What / how to get it |
|---|---|---|
| `PLATFORM_LEGAL_NAME` | ⚪ | Your registered company name on subscription invoices. Default "Scan to Order". |
| `PLATFORM_GSTIN` | ⚪ | Your company's GSTIN. |
| `PLATFORM_ADDRESS` | ⚪ | Your company's registered address. |
| `PLATFORM_BILLING_EMAIL` | ⚪ | Billing contact shown on invoices. |

## Operator alerting

| Key | Req | What / how to get it |
|---|---|---|
| `OPS_ALERT_EMAIL` | ⚪ | Your ops inbox for new-signup / digest alerts (delivered via Resend). |
| `OPS_SLACK_WEBHOOK` | ⚪ | Slack → Apps → Incoming Webhooks → create one for a channel; paste the URL. |

## Super-admin security

| Key | Req | What / how to get it |
|---|---|---|
| `SUPERADMIN_2FA` | ⚪ | `true` to force email-OTP 2FA for super-admin sign-in (authenticator-app 2FA is self-enrolled and always required once enrolled). Default off. |

## Observability

| Key | Req | What / how to get it |
|---|---|---|
| `SENTRY_DSN` | ⚪ | sentry.io → your project → Settings → Client Keys (DSN). Without it, errors log to stderr. |

## Web push notifications (VAPID)
Generate a key pair once: `npx web-push generate-vapid-keys`.

| Key | Req | What / how to get it |
|---|---|---|
| `VAPID_PUBLIC_KEY` | ⚪ | Public key from the generated pair. |
| `VAPID_PRIVATE_KEY` | ⚪ | Private key from the pair. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | ⚪ | Same public key, exposed to the browser to subscribe devices. |
| `VAPID_SUBJECT` | ⚪ | `mailto:you@yourdomain.com`. Defaults to a placeholder. |

## Rate-limiting / cache (optional)

| Key | Req | What / how to get it |
|---|---|---|
| `REDIS_URL` | ⚪ | A Redis URL for shared rate-limiting across instances. Without it, rate-limiting falls back to in-memory (fine for a single instance). From Upstash/Railway/your Redis host. |

## First-run bootstrap (seed / script only — not runtime)

| Key | Req | What / how to get it |
|---|---|---|
| `SUPERADMIN_EMAIL` | ⚪ | Used by `npm run db:seed` to create the first super-admin. (Or run `npm run db:superadmin -- <email> <password>` instead.) |
| `SUPERADMIN_PASSWORD` | ⚪ | Password for that seeded super-admin. |

---

## Minimum to boot locally
```dotenv
DATABASE_URL=postgresql://localhost:5432/scan_to_order
AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Everything else is feature-gated and degrades gracefully (email/WhatsApp log to
console, payments use a dev mock, images fall back to URL paste, etc.).

## Production checklist (typical)
`DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PLATFORM_DOMAIN`,
`ENCRYPTION_KEY`, `CRON_SECRET`, Razorpay (4) + `RAZORPAY_WEBHOOK_SECRET`,
`RESEND_API_KEY` + `EMAIL_FROM`, a messaging provider set, R2 (5),
Cloudflare DNS (3), `SENTRY_DSN`, VAPID (4). Point your scheduler at the cron
endpoints (`sweep` ~15 min; `dunning` / `daily-summary` / `ops-digest` daily)
with the `CRON_SECRET` bearer token.
