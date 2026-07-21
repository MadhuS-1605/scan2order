// E2E fixtures: a SECOND restaurant (for multi-tenant isolation) with a
// counter-paid order (for the refund happy path). Writes the generated ids to
// e2e/fixtures.json so specs can reference them. Run after `db:seed`.
export {}; // module marker (top-level await under tsx's CJS transform)

try {
  process.loadEnvFile();
} catch {
  // env already provided
}

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPassword } from "../src/lib/auth/password";
import { computeTotals } from "../src/lib/pricing";
import { newQrToken } from "../src/lib/qr";

const SLUG = "cafe-two";

async function main() {
  const { prisma } = await import("../src/lib/db");
  await prisma.restaurant.deleteMany({ where: { slug: SLUG } });

  const passwordHash = await hashPassword("password123");
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Cafe Two (E2E)",
      slug: SLUG,
      subdomain: "cafetwo",
      type: "CAFE",
      planTier: "STARTER",
      planActiveUntil: new Date(Date.now() + 365 * 86_400_000),
      config: {
        create: {
          onboardingCompleted: true,
          onboardingStep: 4,
          gstMode: "EXCLUSIVE",
          gstPercentage: 5,
        },
      },
    },
  });
  await prisma.adminUser.create({
    data: {
      name: "Owner Two",
      email: "owner2@e2e.test",
      passwordHash,
      role: "OWNER",
      restaurantId: restaurant.id,
    },
  });
  const cat = await prisma.menuCategory.create({
    data: { restaurantId: restaurant.id, name: "All", sortOrder: 0 },
  });
  const item = await prisma.menuItem.create({
    data: {
      restaurantId: restaurant.id,
      categoryId: cat.id,
      name: "Cappuccino",
      price: 150,
      isVeg: true,
      isAvailable: true,
    },
  });
  const table = await prisma.restaurantTable.create({
    data: { restaurantId: restaurant.id, label: "C1", seats: 2, qrToken: newQrToken() },
  });

  const totals = computeTotals([{ price: 150, quantity: 2 }], "EXCLUSIVE", 5);
  const order = await prisma.order.create({
    data: {
      restaurantId: restaurant.id,
      tableId: table.id,
      orderNumber: 1,
      status: "COMPLETED",
      customerName: "E2E Diner",
      paymentStatus: "PAID",
      paymentMethod: "COUNTER", // counter-paid -> refunds record a manual note
      amountPaid: totals.total,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      totalAmount: totals.total,
      gstMode: "EXCLUSIVE",
      confirmedAt: new Date(),
      items: {
        create: [
          {
            menuItemId: item.id,
            nameSnapshot: item.name,
            priceSnapshot: 150,
            quantity: 2,
            lineTotal: 300,
          },
        ],
      },
    },
  });
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { orderSeq: 1 } });

  const fixtures = {
    owner2Email: "owner2@e2e.test",
    password: "password123",
    slug: SLUG,
    paidOrderId: order.id,
  };
  writeFileSync(join(process.cwd(), "e2e/fixtures.json"), JSON.stringify(fixtures, null, 2));
  console.log("✅ e2e fixtures written:", fixtures);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
