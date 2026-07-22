// One-off: delete the demo restaurant (and everything under it, via cascade)
// from whatever DATABASE_URL is active. Meant for cleaning demo data out of
// prod once staging takes over seeding it.
//
//   DATABASE_URL="<prod-url>" npm run db:remove-demo -- --yes
//
// Requires --yes so it can't be fired by a stray Enter key against prod.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DEMO_SLUG } from "../src/lib/demo/seed-demo";

if (!process.argv.includes("--yes")) {
  console.error(`Refusing to run without --yes. This deletes the "${DEMO_SLUG}" restaurant from:`);
  console.error(`  ${process.env.DATABASE_URL ?? "(DATABASE_URL not set)"}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const { count } = await prisma.restaurant.deleteMany({ where: { slug: DEMO_SLUG } });
  console.log(count ? `Deleted "${DEMO_SLUG}".` : `No restaurant with slug "${DEMO_SLUG}" found — nothing to do.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
