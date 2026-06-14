"use server";

import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { kotEscPos, type KotData } from "@/lib/print/kot";
import { recordAudit } from "@/lib/audit";

async function loadKot(orderId: string, restaurantId: string): Promise<KotData> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
    include: { table: true, items: true, restaurant: { select: { name: true } } },
  });
  if (!order) throw new Error("Order not found");
  return {
    orderNumber: order.orderNumber,
    restaurantName: order.restaurant.name,
    tableLabel: order.table?.label ?? null,
    customerName: order.customerName,
    createdAt: order.createdAt,
    notes: order.notes,
    items: order.items.map((i) => ({
      quantity: i.quantity,
      nameSnapshot: i.nameSnapshot,
      modifiers: i.modifiers,
      notes: i.notes,
    })),
  };
}

// Send a Uint8Array to a network thermal printer over a raw TCP socket (JetDirect/:9100).
function sendToPrinter(
  host: string,
  port: number,
  data: Uint8Array,
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const net = await import("node:net");
    const socket = new net.Socket();
    const fail = (e: Error) => {
      socket.destroy();
      reject(e);
    };
    socket.setTimeout(5000);
    socket.once("timeout", () => fail(new Error("Printer timed out")));
    socket.once("error", fail);
    socket.connect(port, host, () => {
      socket.write(Buffer.from(data), () => socket.end());
    });
    socket.once("close", () => resolve());
  });
}

export type PrintResult = { ok: boolean; error?: string };

// Print a kitchen ticket to the restaurant's configured network printer.
export async function printKotAction(orderId: string): Promise<PrintResult> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "kitchen")) {
    return { ok: false, error: "Not allowed" };
  }
  const config = await prisma.onboardingConfig.findUnique({
    where: { restaurantId: session.restaurantId },
    select: { kotPrinterHost: true, kotPrinterPort: true },
  });
  if (!config?.kotPrinterHost) {
    return {
      ok: false,
      error: "No network printer configured. Add one in Settings → Operations.",
    };
  }
  try {
    const kot = await loadKot(orderId, session.restaurantId);
    await sendToPrinter(
      config.kotPrinterHost,
      config.kotPrinterPort ?? 9100,
      kotEscPos(kot),
    );
    await recordAudit(session.restaurantId, session, "kot.printed", `Order #${kot.orderNumber}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Print failed" };
  }
}
