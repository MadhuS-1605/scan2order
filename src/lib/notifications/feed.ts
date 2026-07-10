import "server-only";
import { prisma } from "@/lib/db";

export type Notif = {
  id: string;
  kind: "order" | "service" | "stock" | "reservation" | "banquet";
  title: string;
  detail: string;
  at: Date;
  href: string;
};

const HOUR = 60 * 60 * 1000;

// A unified, read-only alert feed derived from current data — no separate
// notifications table to keep in sync. Surfaces everything that needs a glance:
// new orders, service calls, low stock, pending reservations & event enquiries.
export async function getNotificationFeed(restaurantId: string): Promise<Notif[]> {
  const since = new Date(Date.now() - 6 * HOUR);
  const [orders, services, lowStock, reservations, banquets] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ["PLACED", "CONFIRMED"] },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { table: true },
    }),
    prisma.serviceRequest.findMany({
      where: { restaurantId, status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { table: true },
    }),
    prisma.menuItem.findMany({
      where: {
        restaurantId,
        trackStock: true,
        stockQty: { lte: prisma.menuItem.fields.lowStockThreshold },
      },
      take: 30,
    }),
    prisma.reservation.findMany({
      where: { restaurantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.banquetBooking.findMany({
      where: { restaurantId, status: "ENQUIRY" },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const feed: Notif[] = [];
  for (const o of orders) {
    feed.push({
      id: `order-${o.id}`,
      kind: "order",
      title: `New order #${o.orderNumber}`,
      detail: `${o.table?.label ?? "Takeaway"}${o.customerName ? ` · ${o.customerName}` : ""}`,
      at: o.createdAt,
      href: "/admin/orders",
    });
  }
  for (const s of services) {
    feed.push({
      id: `svc-${s.id}`,
      kind: "service",
      title: "Service requested",
      detail: `${s.table?.label ?? ""} · ${s.type.replace(/_/g, " ").toLowerCase()}`,
      at: s.createdAt,
      href: "/admin/orders",
    });
  }
  for (const m of lowStock) {
    feed.push({
      id: `stock-${m.id}`,
      kind: "stock",
      title: m.stockQty <= 0 ? `${m.name} sold out` : `Low stock: ${m.name}`,
      detail: `${m.stockQty} left`,
      at: m.updatedAt,
      href: "/admin/inventory",
    });
  }
  for (const r of reservations) {
    feed.push({
      id: `resv-${r.id}`,
      kind: "reservation",
      title: r.type === "WAITLIST" ? `Waitlist: ${r.customerName}` : `Reservation: ${r.customerName}`,
      detail: `${r.partySize} guests${r.reservedFor ? ` · ${r.reservedFor.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}`,
      at: r.createdAt,
      href: "/admin/reservations",
    });
  }
  for (const b of banquets) {
    feed.push({
      id: `banq-${b.id}`,
      kind: "banquet",
      title: `Event enquiry: ${b.eventType}`,
      detail: `${b.customerName} · ${b.guestCount} pax`,
      at: b.createdAt,
      href: "/admin/banquets",
    });
  }

  feed.sort((a, b) => b.at.getTime() - a.at.getTime());
  return feed;
}

// Lightweight count for the header bell badge — only alerts NEWER than the
// admin last viewed the notifications page (passed as `seenMs`). So once they
// open Notifications the badge clears to 0 until something new arrives.
export async function getNotificationCount(
  restaurantId: string,
  seenMs?: number,
): Promise<number> {
  // Cap the look-back at 6h so a long-absent admin doesn't see a huge number.
  const floor = Date.now() - 6 * HOUR;
  const cutoff = new Date(seenMs && seenMs > floor ? seenMs : floor);
  const [orders, services, lowStock, reservations, banquets] = await Promise.all([
    prisma.order.count({
      where: { restaurantId, status: { in: ["PLACED", "CONFIRMED"] }, createdAt: { gt: cutoff } },
    }),
    prisma.serviceRequest.count({
      where: { restaurantId, status: "OPEN", createdAt: { gt: cutoff } },
    }),
    prisma.menuItem.count({
      where: {
        restaurantId,
        trackStock: true,
        stockQty: { lte: prisma.menuItem.fields.lowStockThreshold },
        updatedAt: { gt: cutoff },
      },
    }),
    prisma.reservation.count({
      where: { restaurantId, status: "PENDING", createdAt: { gt: cutoff } },
    }),
    prisma.banquetBooking.count({
      where: { restaurantId, status: "ENQUIRY", createdAt: { gt: cutoff } },
    }),
  ]);
  return orders + services + lowStock + reservations + banquets;
}
