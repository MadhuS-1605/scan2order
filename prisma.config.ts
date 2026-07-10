import { defineConfig } from "prisma/config";

// Prisma 7 config files do not auto-load .env. Node 20.6+ exposes loadEnvFile.
try {
  process.loadEnvFile();
} catch {
  // .env may be absent in CI / production where vars are already set.
}

// Prisma 7 configuration. The runtime connection is made via a driver adapter
// (see src/lib/db.ts); this file only supplies the URL for the migrate/push/
// introspect CLIs. We read process.env directly (not prisma's env() helper) with
// a placeholder fallback so `prisma generate` — which never connects — works
// during `npm ci` / CI where DATABASE_URL isn't set. Push/migrate fail clearly
// against the placeholder if a real URL is genuinely missing.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
