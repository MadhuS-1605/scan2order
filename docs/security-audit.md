# Security Audit — Scan2Order

> **STATUS: REMEDIATED 2026-06-22.** All Critical/High and the actioned
> Medium/Low findings below were fixed (build green, 111 tests pass — incl. new
> tests for timing-safe HMAC, signature verifiers, cron auth, the password-bound
> MFA token, the TOTP replay primitive, and email `escapeHtml`). CSP is now
> **enforcing** (`Content-Security-Policy`, verified via a local server smoke
> test; Razorpay subdomains allow-listed via `https://*.razorpay.com`). Residuals
> noted inline: `next/image` `remotePatterns` stays wildcard (product needs
> tenant-pasted image URLs — mitigated: SVG disabled, optimizer returns images
> only); overage re-valuation tradeoff unchanged (revenue, not security);
> `use-cart.ts:42` set-state-in-effect is pre-existing lint debt. First-deploy
> check: load the Razorpay Checkout flow in a browser and watch the console for
> CSP violations — if Checkout fails to load, add `'unsafe-eval'` to `script-src`
> (or, to fully roll back, swap the header key to `-Report-Only` in `next.config.ts`).

Date: 2026-06-22 · Scope: entire repo (`src/`, `prisma/`, config). Method: static
review across authn/authz, multi-tenant isolation, payments, injection/XSS/SSRF,
uploads, cron/webhook auth, rate-limiting, secrets, HTTP hardening.

**Overall:** solid foundations — admin server actions independently re-authorize
and scope Prisma by the session's `restaurantId`; export/invoice/upload routes
check ownership; JWTs are HS256+`jose`; cookies are httpOnly/sameSite/secure-in-prod;
OTPs are bcrypt-hashed with TTL + attempt caps; the Razorpay webhook verifies the
HMAC over the raw body before parsing; no `dangerouslySetInnerHTML`, no raw SQL,
no secrets logged, only intended values in `NEXT_PUBLIC_*`. The issues below are
the real gaps, highest severity first. (Findings verified against code.)

---

## CRITICAL

### C1 — Non-constant-time HMAC comparison (forgeable webhook/checkout signatures)
`src/lib/payments/razorpay.ts:90,101,114` — `expected === signature`. No
`timingSafeEqual` anywhere in the repo. The webhook secret is platform-wide; a
forged `payment.captured` marks any diner order / tenant plan / overage **PAID
with no money** (`src/app/api/webhook/razorpay/route.ts:44-58`).
**Fix:** `crypto.timingSafeEqual(Buffer.from(a,'hex'), Buffer.from(b,'hex'))` after a length check, for all three verifiers (and cron — see H1).

### C2 — Payment verify trusts the local amount; no captured-amount re-fetch; no replay guard
`src/lib/billing/actions.ts:426-445` (and `verifyPlanPaymentAction`,
`verifyOveragePaymentAction`). The signature only proves `orderId|paymentId` were
issued — not that the amount was captured. No model has `@unique` on
`razorpayPaymentId` (`prisma/schema.prisma` Payment/PlanPayment/OverageCharge), so
a real captured payment id isn't globally single-use.
**Fix:** in each verify path, `razorpay.payments.fetch(paymentId)` and assert
`status==="captured"`, `order_id===razorpayOrderId`, `amount===expectedPaise`
before settling; add `@unique` on `razorpayPaymentId`.

### C3 — Dev mock billing actions are NOT gated to non-production (free plan / overage wipe)
`src/lib/billing/subscription-actions.ts:180` (`mockActivatePlanAction`) and `:400`
(`mockSettleOverageAction`) are guarded only by `if (platformCreds())` — i.e.
**enabled whenever platform Razorpay keys are unset**, which is a normal prod state
(the app supports pay-to-extend without platform keys). Any tenant admin with the
`settings` permission can then self-grant `ENTERPRISE` or wipe overage debt.
(`mockMarkPaidAction` correctly checks `NODE_ENV` — these two don't.)
**Fix:** add `if (process.env.NODE_ENV === "production") return { ok:false }` to both.

### C4 — Super-admin 2FA email path bypasses the password factor
`src/lib/auth/actions.ts` — `verifyAdminOtpAction` takes `email` from the form and
verifies only the OTP/TOTP code; it never re-checks the password.
`sendAdminEmailOtpAction` emails an `ADMIN_LOGIN` code to any super-admin email with
no password. So login degrades to "know the email + guess a 6-digit code" (only
slowed by the 12/15min limiter + 5 attempts/code). Defeats the intent of password+code.
**Fix:** `signinAction` issues a short-lived signed "2fa-pending" token (bound to
userId) only after the password check; `verifyAdminOtpAction` requires + verifies
it instead of trusting a bare `email`.

### C5 — Stored HTML/XSS injection in emails (tenant data, unescaped)
No `escapeHtml` exists; every email HTML interpolates tenant-controlled values raw:
`src/lib/billing/actions.ts:654-655` (bill email → **arbitrary diner address**),
`src/lib/platform/actions.ts:421` (invite — attacker controls name *and* recipient)
& `:466-467` (win-back), `src/lib/reports/daily.ts:124,126`, `src/lib/billing/dunning.ts:25-27`.
A tenant stores `<a>`/`<img onerror>`/phishing in their restaurant/owner name and it
ships from your trusted sender.
**Fix:** add `escapeHtml()` (`& < > " '`) and wrap every interpolated user value; never place user data in `href`/attributes.

---

## HIGH

### H1 — Cron secret accepted via `?key=` query string (log leakage) + non-constant-time compare
All `src/app/api/cron/*` routes fall back to `searchParams.get("key")` and compare
with `!==`. Query strings land in access/proxy/CDN logs; `backfill-subdomains`
mutates Cloudflare DNS for every tenant, `dunning` emails every owner.
**Fix:** header-only (`Authorization: Bearer`), `timingSafeEqual`.

### H2 — SSRF via tenant `logoUrl` fetched server-side (no allow-list)
`src/lib/billing/pdf.ts:72-82` `fetch(restaurant.logoUrl)` (any diner can trigger via
the bill-PDF route). `logoUrl` is only `z.string().url()`, so `http://169.254.169.254/…`,
`http://127.0.0.1/…` pass. The repo already has `isSafeWebhookUrl()`
(`src/lib/integrations/webhooks.ts:11`) but it's not applied here.
**Fix:** guard `logoUrl` with `isSafeWebhookUrl()` (or restrict to the R2 CDN base) before fetching.

### H3 — Order status / mark-paid actions lack a permission check (intra-tenant priv-esc)
`src/lib/orders/actions.ts` `setOrderStatusAction`, `confirmOrderAction`,
`rejectOrderAction`, **`markPaidAction`** use only `requireOnboardedAdmin()` — any
authenticated role (e.g. KITCHEN) can confirm/cancel orders and **mark bills PAID**.
**Fix:** `requireAdminWithPermission("orders")` (dedicated perm for mark-paid).

### H4 — `AUTH_SECRET` strength never validated
`src/lib/env.ts:11` only checks non-empty. A weak secret → offline-forgeable session
JWTs (mint `isSuperAdmin`/any `restaurantId`/`impersonatorId`). All other session-trust
findings (impersonation, suspension bypass) reduce to this.
**Fix:** reject `< 32` bytes at startup.

### H5 — `qrToken` is a CUID, not CSPRNG (diner bill/order access is guessable)
`prisma/schema.prisma` `qrToken @default(cuid())` is the **only** secret gating a
diner's bill view, tip, coupon, room-charge, and payment-intent for an order. CUIDs
embed time+counter (low random entropy); tables are batch-created at onboarding.
**Fix:** generate with `randomBytes(24).toString("base64url")`; migrate.

### H6 — Upload trusts client `content-type` (no magic-byte sniff) + public CDN
`src/app/api/upload/route.ts:24` + `src/lib/storage/r2.ts:48-57` store/serve with the
browser-supplied MIME; the extension allowlist is satisfiable with arbitrary bytes.
Served from a public CDN → stored content-injection/XSS risk (esp. if the CDN shares
the app origin). (Folder is correctly session-scoped — no cross-tenant write.)
**Fix:** sniff bytes server-side, pin the sniffed content-type, serve with
`X-Content-Type-Options: nosniff` from a cookieless domain.

### H7 — No security headers / CSP; `next/image` allows any HTTPS host
`next.config.ts` sets no `headers()` (no CSP, HSTS, X-Frame-Options, nosniff,
Referrer-Policy) and `images.remotePatterns: [{ hostname: "**" }]` (open image proxy/SSRF).
**Fix:** add a strict `headers()` block + CSP; restrict `remotePatterns` to your CDN.

### H8 — Rate limiter fails open + per-instance without Redis
`src/lib/ratelimit.ts:57-61` returns `true` on Redis error; in-memory `Map` otherwise.
A Redis outage or multi-instance deploy without `REDIS_URL` removes brute-force
protection on login/2FA/OTP (compounds C4).
**Fix:** fail closed for auth limiters; require `REDIS_URL` in prod.

### H9 — Plaintext per-tenant Razorpay secret; client-trusted auto-renew tier; non-atomic coupon redemption
- `src/lib/settings/actions.ts` stores `razorpayKeySecret` plaintext though
  `encryptSecret` exists (used for TOTP). DB leak → every tenant's gateway secret.
- `verifyAutoRenewAction` writes `args.tier` (client) to `planTier` without checking
  the Razorpay plan id → self-upgrade to ENTERPRISE.
- Plan-coupon `redeemedCount` increment isn't conditionally guarded
  (`subscription-actions.ts`), unlike the diner-coupon path → over-redemption races.
**Fix:** encrypt the gateway secret at rest; derive tier from the subscription's plan id; conditional `updateMany({where:{code, redeemedCount:{lt:max}}})`.

---

## MEDIUM
- **`ENCRYPTION_KEY` optional** → TOTP (and, post-fix, gateway) secrets stored plaintext silently when unset. Require it in prod. (`src/lib/crypto.ts:17`)
- **No rate limit** on `setPasswordAction` (invite-token brute force), `signupAction` (account spam), `createPaymentIntentAction` (gateway-order spam). (`src/lib/auth/actions.ts`, `src/lib/billing/actions.ts`)
- **`imageUrl`/`logoUrl` accept `javascript:`/`data:` schemes** (`z.url()` only); blocked at render by `next/image`, but tighten to `^https?://` + reject quotes in the CSS `url("…")` preview (`src/components/admin/image-upload.tsx:73`).
- **WhatsApp campaigns**: tenant-authored blasts to diners with only a per-blast cap (500), no consent/opt-out, no daily limit → spam/phishing abuse. (`src/lib/campaigns/actions.ts`)
- **`updateItemAction` writes a client `categoryId`** without verifying tenant ownership (`src/lib/menu/actions.ts`).
- **Overage re-valued at current tier** lets a higher-allowance tier reduce past-month overage (documented v1 tradeoff; revenue leak). (`src/lib/billing/overage.ts:59-73`)
- **TOTP has no replay/last-step guard** — a code is reusable within its ~90s window (`src/lib/auth/totp.ts`).

## LOW / informational
- Proxy table cookie lacks `secure` in prod (`src/proxy.ts:52-57`); opaque token, low risk.
- Invoice number derived from id suffix — fine. Export routes have no rate limit (authed, low concern).
- Subscription `subscription.charged` extends without re-affirming tier/amount (perpetuates H9 tier).

## Verified clean (no action)
Tenant isolation on admin mutations; export/invoice/upload authZ + folder scoping;
webhook verifies raw body before parse + idempotent; `placeOrderAction` re-prices
server-side + cookie-token match; `createPaymentIntentAction` clamps amount
server-side (can't overpay); staff actions scoped + exclude OWNER; property switch
checks `groupId`; no `dangerouslySetInnerHTML` / raw SQL; secrets not logged;
`NEXT_PUBLIC_*` only exposes the public Razorpay key id + VAPID public key.

---

## Remediation order (recommended)
1. **C1** timing-safe HMAC, **H1** cron header-only+timing-safe — small, high-impact.
2. **C3** add `NODE_ENV` guard to the two mock actions — one-liners, stops free plans.
3. **C2** verify captured amount/status + `@unique razorpayPaymentId`.
4. **C4** password-bound 2fa-pending token.
5. **C5** `escapeHtml()` across all email templates.
6. **H2** apply `isSafeWebhookUrl` to `logoUrl`; **H3** add `orders` permission to order/mark-paid actions.
7. **H4** validate `AUTH_SECRET` length; **H5** CSPRNG `qrToken`.
8. **H6/H7** upload sniffing + CSP/headers + `remotePatterns`; **H8** rate-limiter fail-closed + require Redis.
9. **H9** encrypt gateway secret, server-derive renew tier, atomic coupon.
10. Medium/Low as capacity allows.
