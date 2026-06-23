import { execSync } from "node:child_process";

// Prepare a disposable (local/CI) database for the suite: sync the schema, then
// reseed the demo + e2e fixtures so every run is deterministic. Requires
// DATABASE_URL to point at a throwaway database.
export default function globalSetup() {
  // Fresh CI databases have no tables yet — push the schema first.
  // --accept-data-loss is safe here: the target is always a disposable test DB.
  execSync("npx prisma db push --accept-data-loss", { stdio: "inherit" });
  execSync("npm run db:seed && npm run db:seed:e2e", { stdio: "inherit" });
}
