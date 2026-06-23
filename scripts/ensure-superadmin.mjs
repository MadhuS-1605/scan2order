// Idempotently ensure a platform super-admin exists, driven by env vars.
// Runs at deploy time (pre-deploy) so the operator can sign in immediately
// without manually running a one-off script against prod.
//
//   SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD  -> upserts an isSuperAdmin owner.
//
// Plain Node (no tsx) so it works in the pruned runtime image — uses only
// runtime deps (@prisma/client, @prisma/adapter-pg, bcryptjs).
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const email = (process.env.SUPERADMIN_EMAIL ?? "").toLowerCase().trim();
const password = process.env.SUPERADMIN_PASSWORD ?? "";

if (!email || !password) {
  console.log("[superadmin] SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD not set — skipping bootstrap.");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("[superadmin] DATABASE_URL not set — cannot bootstrap.");
  process.exit(0); // don't fail the deploy over this
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

try {
  const passwordHash = await bcrypt.hash(password, 10);
  // The env email+password is the source of truth for this bootstrap account, so
  // we (re)set the password on every deploy — keeps the operator able to sign in.
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { isSuperAdmin: true, passwordHash, disabled: false },
    create: { name: "Platform Admin", email, passwordHash, role: "OWNER", isSuperAdmin: true },
  });
  console.log(`[superadmin] ready: ${user.email} (isSuperAdmin=${user.isSuperAdmin})`);
} catch (e) {
  console.error("[superadmin] bootstrap failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
