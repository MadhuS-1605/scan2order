// Create or promote a platform super-admin (no restaurant). Idempotent.
// Usage:  DATABASE_URL="<url>" tsx scripts/create-superadmin.ts <email> <password>
//   or:   DATABASE_URL="<url>" npm run db:superadmin -- <email> <password>
export {}; // module marker

try {
  process.loadEnvFile();
} catch {
  // env already provided (e.g. inline DATABASE_URL)
}

async function main() {
  const email = (process.argv[2] ?? "").toLowerCase().trim();
  const password = process.argv[3] ?? "";
  if (!email || !password) {
    console.error("usage: tsx scripts/create-superadmin.ts <email> <password>");
    process.exit(1);
  }

  // Imported after loadEnvFile so db.ts reads DATABASE_URL from the env.
  const { prisma } = await import("../src/lib/db");
  const { hashPassword } = await import("../src/lib/auth/password");

  const passwordHash = await hashPassword(password);
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { isSuperAdmin: true, passwordHash },
    create: { name: "Platform Admin", email, passwordHash, role: "OWNER", isSuperAdmin: true },
  });
  console.log(`✅ super-admin ready: ${user.email} (isSuperAdmin=${user.isSuperAdmin})`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
