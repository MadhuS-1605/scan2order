// Demo data seed. Run with `npm run db:seed`.
// Uses relative imports because tsx does not resolve the "@/..." path alias.
try {
  process.loadEnvFile();
} catch {
  // env already present
}

import { hashPassword } from "../src/lib/auth/password";
import { computeTotals } from "../src/lib/pricing";

const SLUG = "spice-garden-demo";

async function main() {
  // db.ts reads DATABASE_URL at import time, so import it after loadEnvFile.
  const { prisma } = await import("../src/lib/db");
  // Reset any prior demo data (cascades to all children).
  await prisma.restaurant.deleteMany({ where: { slug: SLUG } });

  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Spice Garden (Demo)",
      slug: SLUG,
      subdomain: "spicegarden",
      type: "RESTAURANT",
      phone: "+91 98765 43210",
      email: "demo@spicegarden.in",
      addressLine: "12 MG Road",
      city: "Bengaluru",
      state: "Karnataka",
      postalCode: "560001",
      config: {
        create: {
          orderConfirmation: "WAITER_CONFIRM",
          paymentTiming: "PAY_AFTER",
          onlinePaymentEnabled: true,
          counterPaymentEnabled: true,
          gstMode: "EXCLUSIVE",
          gstPercentage: 5,
          gstNumber: "29ABCDE1234F1Z5",
          reviewUrl: "https://g.page/r/demo-review",
          happyHourEnabled: true,
          happyHourFrom: "16:00",
          happyHourTo: "19:00",
          happyHourPercent: 20,
          languages: "en,kn,hi",
          upiId: "spicegarden@oksbi",
          upiName: "Spice Garden",
          featureReservations: true,
          featureRooms: true,
          featureBanquets: true,
          featureBar: true,
          featureAttendance: true,
          // Demo venue location (Koramangala, Bengaluru) so staff clock-in is
          // testable; staff must be within geofenceRadiusM metres to punch.
          latitude: 12.9352,
          longitude: 77.6245,
          geofenceRadiusM: 150,
          // Anti-fake-order: diners must be on-site to order (lenient radius).
          requireDinerLocation: true,
          orderRadiusM: 300,
          onboardingStep: 4,
          onboardingCompleted: true,
        },
      },
    },
    include: { config: true },
  });

  const staffPass = await hashPassword("password123");
  // Owner signs in with email; staff also get a username so they can sign in at
  // the restaurant link (spicegarden.scan.to/signin) without an email.
  await prisma.adminUser.createMany({
    data: [
      { name: "Demo Owner", email: "demo@scan.to", passwordHash: staffPass, role: "OWNER", restaurantId: restaurant.id },
      { name: "Demo Manager", email: "manager@scan.to", username: "manager", passwordHash: staffPass, role: "MANAGER", restaurantId: restaurant.id },
      { name: "Demo Cashier", email: "cashier@scan.to", username: "cashier", passwordHash: staffPass, role: "CASHIER", restaurantId: restaurant.id },
      { name: "Demo Waiter", email: "waiter@scan.to", username: "waiter", passwordHash: staffPass, role: "WAITER", restaurantId: restaurant.id },
      { name: "Demo Kitchen", email: "kitchen@scan.to", username: "kitchen", passwordHash: staffPass, role: "KITCHEN", restaurantId: restaurant.id },
    ],
  });

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

  // Seed a couple of attendance punches (one closed shift + one open) so the
  // attendance board and "on shift now" panel have data to show.
  const waiterUser = await prisma.adminUser.findFirst({
    where: { restaurantId: restaurant.id, username: "waiter" },
    select: { id: true },
  });
  const cashierUser = await prisma.adminUser.findFirst({
    where: { restaurantId: restaurant.id, username: "cashier" },
    select: { id: true },
  });
  const dayStart = new Date();
  dayStart.setHours(9, 0, 0, 0);
  if (waiterUser) {
    await prisma.staffAttendance.create({
      data: {
        restaurantId: restaurant.id,
        adminUserId: waiterUser.id,
        clockInAt: dayStart,
        clockOutAt: new Date(dayStart.getTime() + 5 * 60 * 60 * 1000),
        clockInLat: 12.9352,
        clockInLng: 77.6245,
        source: "SELF",
      },
    });
  }
  if (cashierUser) {
    await prisma.staffAttendance.create({
      data: {
        restaurantId: restaurant.id,
        adminUserId: cashierUser.id,
        clockInAt: new Date(dayStart.getTime() + 30 * 60 * 1000),
        clockInLat: 12.9352,
        clockInLng: 77.6245,
        source: "SELF",
      },
    });
  }

  const categories = await Promise.all(
    [
      { name: "Starters", icon: "🍢", station: "KITCHEN" },
      { name: "Main Course", icon: "🍛", station: "KITCHEN" },
      { name: "Breads", icon: "🫓", station: "KITCHEN" },
      { name: "Beverages", icon: "🥤", station: "BAR" },
    ].map((c, i) =>
      prisma.menuCategory.create({
        data: { restaurantId: restaurant.id, name: c.name, icon: c.icon, station: c.station, sortOrder: i },
      }),
    ),
  );
  const [starters, mains, breads, drinks] = categories;

  const menuData: Array<[string, number, string, boolean, boolean]> = [
    // name, price, categoryId, isVeg, isSpecial
    ["Paneer Tikka", 220, starters.id, true, true],
    ["Chicken 65", 260, starters.id, false, false],
    ["Veg Spring Roll", 180, starters.id, true, false],
    ["Butter Chicken", 340, mains.id, false, true],
    ["Paneer Butter Masala", 300, mains.id, true, false],
    ["Dal Makhani", 240, mains.id, true, false],
    ["Hyderabadi Biryani", 320, mains.id, false, false],
    ["Butter Naan", 60, breads.id, true, false],
    ["Garlic Naan", 80, breads.id, true, false],
    ["Masala Chai", 40, drinks.id, true, false],
    ["Fresh Lime Soda", 90, drinks.id, true, false],
    ["Cold Coffee", 140, drinks.id, true, false],
  ];

  const items = await Promise.all(
    menuData.map(([name, price, categoryId, isVeg, isSpecialOfDay], i) =>
      prisma.menuItem.create({
        data: {
          restaurantId: restaurant.id,
          categoryId,
          name,
          price,
          isVeg,
          isSpecialOfDay,
          isAvailable: true,
          sortOrder: i,
          description: isSpecialOfDay ? "Chef's special today" : null,
        },
      }),
    ),
  );

  // Demo translations (Hindi + Kannada) for every item.
  const TRANSLATIONS: Record<string, { hi: string; kn: string }> = {
    "Paneer Tikka": { hi: "पनीर टिक्का", kn: "ಪನೀರ್ ಟಿಕ್ಕಾ" },
    "Chicken 65": { hi: "चिकन 65", kn: "ಚಿಕನ್ 65" },
    "Veg Spring Roll": { hi: "वेज स्प्रिंग रोल", kn: "ವೆಜ್ ಸ್ಪ್ರಿಂಗ್ ರೋಲ್" },
    "Butter Chicken": { hi: "बटर चिकन", kn: "ಬೆಣ್ಣೆ ಚಿಕನ್" },
    "Paneer Butter Masala": { hi: "पनीर बटर मसाला", kn: "ಪನೀರ್ ಬಟರ್ ಮಸಾಲಾ" },
    "Dal Makhani": { hi: "दाल मखनी", kn: "ದಾಲ್ ಮಖನಿ" },
    "Hyderabadi Biryani": { hi: "हैदराबादी बिरयानी", kn: "ಹೈದರಾಬಾದಿ ಬಿರಿಯಾನಿ" },
    "Butter Naan": { hi: "बटर नान", kn: "ಬೆಣ್ಣೆ ನಾನ್" },
    "Garlic Naan": { hi: "गार्लिक नान", kn: "ಗಾರ್ಲಿಕ್ ನಾನ್" },
    "Masala Chai": { hi: "मसाला चाय", kn: "ಮಸಾಲಾ ಚಹಾ" },
    "Fresh Lime Soda": { hi: "फ्रेश लाइम सोडा", kn: "ಫ್ರೆಶ್ ಲೈಮ್ ಸೋಡಾ" },
    "Cold Coffee": { hi: "कोल्ड कॉफ़ी", kn: "ಕೋಲ್ಡ್ ಕಾಫಿ" },
  };
  for (const [itemName, t] of Object.entries(TRANSLATIONS)) {
    await prisma.menuItem.updateMany({
      where: { restaurantId: restaurant.id, name: itemName },
      data: { translations: { hi: { name: t.hi }, kn: { name: t.kn } } },
    });
  }

  // Track stock on a couple of items to demo inventory + auto stock-out.
  await prisma.menuItem.updateMany({
    where: { restaurantId: restaurant.id, name: "Cold Coffee" },
    data: { trackStock: true, stockQty: 30, lowStockThreshold: 5 },
  });
  await prisma.menuItem.updateMany({
    where: { restaurantId: restaurant.id, name: "Hyderabadi Biryani" },
    data: { trackStock: true, stockQty: 15, lowStockThreshold: 3 },
  });

  const tables = await Promise.all(
    ["T1", "T2", "T3", "T4", "T5", "T6"].map((label, i) =>
      prisma.restaurantTable.create({
        data: { restaurantId: restaurant.id, label, seats: i < 2 ? 2 : 4 },
      }),
    ),
  );

  await prisma.coupon.createMany({
    data: [
      { restaurantId: restaurant.id, code: "SAVE20", type: "PERCENT", value: 20, minOrder: 0, maxDiscount: 150 },
      { restaurantId: restaurant.id, code: "FLAT50", type: "FLAT", value: 50, minOrder: 300 },
    ],
  });

  const resDate = new Date();
  resDate.setDate(resDate.getDate() + 1);
  resDate.setHours(20, 0, 0, 0);
  await prisma.reservation.createMany({
    data: [
      { restaurantId: restaurant.id, type: "RESERVATION", customerName: "Priya Nair", customerPhone: "+919812000111", partySize: 4, reservedFor: resDate, status: "CONFIRMED", notes: "Window seat" },
      { restaurantId: restaurant.id, type: "WAITLIST", customerName: "Arjun Rao", customerPhone: "+919812000222", partySize: 2, status: "PENDING" },
    ],
  });

  // A few demo orders across statuses.
  const gstPct = Number(restaurant.config!.gstPercentage.toString());
  type Spec = {
    tableIdx: number;
    lines: Array<[number, number]>; // [itemIndex, qty]
    status:
      | "PLACED"
      | "CONFIRMED"
      | "PREPARING"
      | "READY"
      | "SERVED"
      | "COMPLETED";
    paid?: boolean;
    name?: string;
  };
  const specs: Spec[] = [
    { tableIdx: 0, lines: [[0, 1], [7, 2], [9, 2]], status: "PLACED", name: "Ravi" },
    { tableIdx: 1, lines: [[3, 1], [7, 2]], status: "CONFIRMED", name: "Meera" },
    { tableIdx: 2, lines: [[6, 2], [10, 2]], status: "PREPARING" },
    { tableIdx: 3, lines: [[1, 1], [4, 1], [8, 2]], status: "READY", name: "Sanjay" },
    { tableIdx: 4, lines: [[11, 2]], status: "SERVED" },
    {
      tableIdx: 5,
      lines: [[3, 2], [7, 4], [9, 3]],
      status: "COMPLETED",
      paid: true,
      name: "Anita",
    },
  ];

  for (const spec of specs) {
    const lines = spec.lines.map(([idx, qty]) => ({
      item: items[idx],
      qty,
    }));
    const totals = computeTotals(
      lines.map((l) => ({ price: Number(l.item.price.toString()), quantity: l.qty })),
      "EXCLUSIVE",
      gstPct,
    );
    const seq = await nextOrderSeq(prisma, restaurant.id);
    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        tableId: tables[spec.tableIdx].id,
        orderNumber: seq,
        status: spec.status,
        customerName: spec.name ?? null,
        paymentStatus: spec.paid ? "PAID" : "UNPAID",
        paymentMethod: spec.paid ? "COUNTER" : null,
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        totalAmount: totals.total,
        gstMode: "EXCLUSIVE",
        confirmedAt: spec.status === "PLACED" ? null : new Date(),
        items: {
          create: lines.map((l) => ({
            menuItemId: l.item.id,
            nameSnapshot: l.item.name,
            priceSnapshot: l.item.price,
            quantity: l.qty,
            lineTotal: Number(l.item.price.toString()) * l.qty,
          })),
        },
      },
    });
  }

  console.log("Seeded:", {
    restaurant: restaurant.name,
    login: "demo@scan.to / password123",
    items: items.length,
    tables: tables.length,
    orders: specs.length,
  });
}

async function nextOrderSeq(
  prisma: Awaited<typeof import("../src/lib/db")>["prisma"],
  restaurantId: string,
): Promise<number> {
  const r = await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { orderSeq: { increment: 1 } },
    select: { orderSeq: true },
  });
  return r.orderSeq;
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
