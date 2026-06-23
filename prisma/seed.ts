// Demo data seed. Run with `npm run db:seed`.
// Uses relative imports because tsx does not resolve the "@/..." path alias.
try {
  process.loadEnvFile();
} catch {
  // env already present
}

import { hashPassword } from "../src/lib/auth/password";
import { seedDemoRestaurant } from "../src/lib/demo/seed-demo";

async function main() {
  // db.ts reads DATABASE_URL at import time, so import it after loadEnvFile.
  const { prisma } = await import("../src/lib/db");

  // Build/reset the demo tenant (shared with the nightly reset cron).
  const demo = await seedDemoRestaurant(prisma);

  // Platform super-admin — no restaurant of its own, so it lands on /superadmin.
  // demo@ stays a plain owner for testing the restaurant dashboard. Credentials
  // are NOT hardcoded: set SUPERADMIN_EMAIL + SUPERADMIN_PASSWORD in the env to
  // seed one, otherwise this is skipped and you create it out-of-band with
  // `npm run db:superadmin -- <email> <password>` (nothing lands in the repo).
  const superEmail = process.env.SUPERADMIN_EMAIL?.toLowerCase().trim();
  const superPassword = process.env.SUPERADMIN_PASSWORD;
  if (superEmail && superPassword) {
    const passwordHash = await hashPassword(superPassword);
    await prisma.adminUser.upsert({
      where: { email: superEmail },
      update: { isSuperAdmin: true, passwordHash },
      create: { name: "Platform Admin", email: superEmail, passwordHash, role: "OWNER", isSuperAdmin: true },
    });
    console.log(`✅ super-admin seeded: ${superEmail}`);
  } else {
    console.log("ℹ no SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD set — skipping super-admin seed (use `npm run db:superadmin`)");
  }

  console.log("Seeded:", {
    restaurant: "Spice Garden (Demo)",
    login: "demo@scan.to / password123",
    items: demo.items,
    orders: demo.orders,
  });
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
