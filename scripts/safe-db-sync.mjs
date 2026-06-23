// Data-safe schema sync for deploys.
//
// `prisma db push` refuses to add even a unique index without --accept-data-loss,
// but that flag would ALSO silently drop columns/tables on a destructive change.
// So we can't use the flag as a safety switch. Instead:
//   1. Diff the live DB against the schema (prisma migrate diff -> SQL).
//   2. If the SQL contains a genuinely destructive op (DROP TABLE / DROP COLUMN),
//      ABORT the deploy loudly — never auto-destroy production data.
//   3. Otherwise it's additive (incl. unique indexes) — apply with db push.
//
// Plain Node so it runs in the pruned runtime image (prisma is a dependency).
import { execFileSync } from "node:child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[db-sync] DATABASE_URL is not set — cannot sync schema.");
  process.exit(1);
}

function prisma(args, opts = {}) {
  return execFileSync("npx", ["prisma", ...args], { encoding: "utf8", ...opts });
}

let sql = "";
try {
  // --from-config-datasource = the live DB (URL from prisma.config.ts / env);
  // --to-schema = the desired datamodel. The diff SQL turns the former into the
  // latter, so any DROP TABLE/COLUMN means the schema removed something live.
  sql = prisma([
    "migrate",
    "diff",
    "--from-config-datasource",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
  ]);
} catch (e) {
  console.error("[db-sync] failed to diff schema:", e.message ?? e);
  process.exit(1);
}

// Truly destructive ops that LOSE data. (DROP DEFAULT / DROP NOT NULL /
// DROP CONSTRAINT / DROP INDEX are not data loss, so match only TABLE/COLUMN.)
const destructive = sql
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => /\bDROP\s+TABLE\b/i.test(l) || /\bDROP\s+COLUMN\b/i.test(l));

if (destructive.length > 0) {
  console.error(
    "\n[db-sync] ABORTING DEPLOY — destructive schema change detected (would delete production data):",
  );
  for (const l of destructive) console.error("    " + l);
  console.error(
    "\n[db-sync] This is the data-loss safeguard. Review the change and apply it deliberately\n" +
      "          (e.g. an additive add → backfill → drop sequence, or a reviewed migration with a\n" +
      "          fresh backup). Refusing to auto-drop data.\n",
  );
  process.exit(1);
}

if (!sql.trim()) {
  console.log("[db-sync] schema already in sync — nothing to apply.");
  process.exit(0);
}

console.log("[db-sync] changes are additive (no DROP TABLE/COLUMN) — applying...");
try {
  prisma(["db", "push", "--accept-data-loss"], { stdio: "inherit" });
} catch (e) {
  console.error("[db-sync] db push failed:", e.message ?? e);
  process.exit(1);
}
console.log("[db-sync] schema applied.");
