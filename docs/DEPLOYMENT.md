# Deployment & scaling notes

Things that work fine on a single instance but need attention before scaling
horizontally / going to production. Captured from the 2026-06-14 code audit.

## 1. Single-instance state (needs Redis to scale out)

Two subsystems keep state in process memory (on `globalThis`), so they are
**correct only on a single server instance**:

- **Realtime bus** — `src/lib/realtime/bus.ts` (in-memory `EventEmitter`). With
  2+ instances / serverless, an SSE subscriber on instance A won't receive
  events emitted on instance B → live order/kitchen/floor updates break.
- **Order rate limiter** — `src/lib/ratelimit.ts` (in-memory `Map`). Per-instance,
  so the order-spam cap can be bypassed by spreading requests across instances.

**Fix to scale:** back both with Redis pub/sub + Redis counters (e.g. Upstash for
serverless) behind the same function signatures. (OTP rate-limiting is already
DB-backed and scale-safe.)

## 2. Database migrations (drift)

Schema has evolved with a mix of tracked migrations (`prisma/migrations/`) and
`prisma db push` during rapid iteration, so the live schema can be ahead of the
last migration. Before a tracked deploy:

1. On a clean DB, run `prisma migrate diff` (from last migration → `schema.prisma`)
   to generate the catch-up SQL, or create a fresh squashed baseline migration.
2. Verify against a staging copy, then `prisma migrate deploy` in the pipeline.
3. Stop using `db push` against shared/staging/prod DBs (dev-only).

## 3. Secrets & env

- `.env` is git-ignored (good). For production set a **high-entropy random**
  `AUTH_SECRET` (the dev value is a readable phrase — fine for local, not prod).
- `DATABASE_URL` and `AUTH_SECRET` are required (the app throws at startup if
  missing — good). Razorpay (`RAZORPAY_KEY_*`) and messaging (`META_WHATSAPP_*`)
  are **optional and fail silently at use-time** if only partially configured —
  set both halves or leave both unset. Regenerate VAPID keys per environment.

## 4. Observability

- Webhook dispatch failures are now logged (`console.error` in `bus.ts`) instead
  of swallowed — wire these into a real logger/Sentry in prod and add retries.
- No structured logging / error monitoring yet — add before production load.

## 5. Performance notes

- `requireAdmin` (`src/lib/auth/guards.ts`) does one indexed DB read per admin
  request (deliberate — makes disable/role changes live). Cache for a few seconds
  only if profiling demands it; never drop it.
- Admin list pages are bounded today (active orders, capped audit/history). Add
  real pagination if any tenant's history/customers grow large.

## 6. Railway

`railway.json` pins the build/start/healthcheck (Nixpacks, `npm run build` →
`npm run start`, healthcheck `/`, 1 replica). Steps:

1. **Add PostgreSQL** (Railway → New → Database → PostgreSQL). No volume / object
   storage is needed — all persistent data is in Postgres (images are URLs;
   bills/KOT are generated on the fly).
2. **Deploy the repo** as a service. `start` binds Railway's `$PORT`.
3. **Variables:** `DATABASE_URL=${{Postgres.DATABASE_URL}}`, a strong
   `AUTH_SECRET` (`openssl rand -base64 32`, then leave it fixed),
   `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PLATFORM_DOMAIN`, plus optional
   Razorpay/WhatsApp/VAPID. **`NEXT_PUBLIC_*` are inlined at build time** — set them
   before building, then redeploy once the domain exists.
4. **Push the schema** (no migration history — uses `db push`):
   `railway run npm run db:deploy` (runs `prisma db push` with the service's
   `DATABASE_URL` injected, so nothing is typed by hand). Re-run after schema
   changes. It aborts on data-loss warnings by design — review before forcing.
5. **Generate a domain** (Settings → Networking) → set `NEXT_PUBLIC_APP_URL` →
   redeploy. HTTPS is automatic (PWA/push/geolocation work).
6. **Redis only if scaling:** add a Redis service + `REDIS_URL=${{Redis.REDIS_URL}}`
   and only then raise replicas above 1.

## 7. Testing

No automated tests exist; the money/auth/order flows are verified manually. Add a
unit/integration suite (payments + settlement, auth guards, order placement,
table-based billing) before relying on this in production — it's the biggest
long-term risk.
