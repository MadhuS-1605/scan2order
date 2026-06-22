# Backup & disaster recovery

Operational runbook for the Scan to Order platform data. Keep this current.

## What to protect
- **PostgreSQL** — the system of record (tenants, orders, billing, usage, config). This is the critical asset.
- **Cloudflare R2 bucket** — tenant images (menu photos, logos). R2 is durable; enable bucket **versioning** for accidental-overwrite recovery.
- **Secrets** — `.env` / platform env vars (`AUTH_SECRET`, `ENCRYPTION_KEY`, Razorpay/Resend/Meta/Cloudflare keys). Store in a secrets manager, **not** in backups. Losing `ENCRYPTION_KEY` makes encrypted TOTP secrets unrecoverable (operators just re-enrol).

## PostgreSQL backups
- **Managed host (recommended):** enable the provider's automated daily backups + point-in-time recovery (PITR). Railway/Neon/RDS all offer this — turn it on and set retention (≥7 days).
- **Self-managed / belt-and-suspenders:** scheduled `pg_dump`:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --file=backup-$(date +%F).dump
  # restore:
  pg_restore --clean --if-exists --dbname="$DATABASE_URL" backup-YYYY-MM-DD.dump
  ```
  Run daily via cron; upload the dump to off-site storage (e.g. a private R2 bucket) with ≥30-day retention.
- **Schema:** the source of truth is `prisma/schema.prisma`; apply with `npm run db:deploy` (`prisma db push`). Migrations live in `prisma/migrations/`.

## Restore drill (do this before you need it)
1. Provision a fresh Postgres, set `DATABASE_URL`.
2. `pg_restore` the latest dump (or restore the managed snapshot).
3. `npm run db:generate` and deploy the app pointing at it.
4. Recreate a super-admin if needed: `npm run db:superadmin -- <email> <password>`.
5. Re-sync tenant subdomains if DNS drifted: cron `GET /api/cron/backfill-subdomains`.

## Recovery objectives (set + monitor)
- **RPO** (max data loss): ≤24h with daily dumps; minutes with managed PITR.
- **RTO** (time to restore): target < 1h — rehearse the drill quarterly.

## Health & monitoring
- Sentry (`SENTRY_DSN`) for errors; the super-admin **Health** page surfaces failed payments, refunds, stuck orders, and service-config status.
- The cron endpoints (`/api/cron/sweep`, `dunning`, `daily-summary`, `ops-digest`) should be monitored for successful runs.
