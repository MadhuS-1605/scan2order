import { execSync } from "node:child_process";

// Reseed the demo + e2e fixtures before the suite so runs are deterministic.
// Requires DATABASE_URL to point at a disposable (local/CI) database.
export default function globalSetup() {
  execSync("npm run db:seed && npm run db:seed:e2e", { stdio: "inherit" });
}
