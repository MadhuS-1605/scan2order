import { defineConfig, env } from "prisma/config";

// Prisma 7 config files do not auto-load .env. Node 20.6+ exposes loadEnvFile.
try {
  process.loadEnvFile();
} catch {
  // .env may be absent in CI / production where vars are already set.
}

// Prisma 7 configuration. The runtime connection is made via a driver adapter
// (see src/lib/db.ts); this file supplies the URL for migrate/introspect CLIs.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
