"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminWithPermission } from "@/lib/auth/guards";
import { hasCapability } from "@/lib/capabilities";
import { sendWhatsAppFreeform } from "@/lib/messaging/provider";
import { recordUsage } from "@/lib/usage";
import { recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import type { ActionState } from "@/lib/validation";

const MAX_RECIPIENTS = 500;
const DAY = 86_400_000;

export type Segment = "all" | "repeat" | "recent";

// Per-restaurant guests (via orders) matching a segment, with phone numbers.
export async function segmentCounts(restaurantId: string): Promise<Record<Segment, number>> {
  const since = new Date(Date.now() - 30 * DAY);
  const customers = await prisma.customer.findMany({
    where: { orders: { some: { restaurantId } } },
    select: {
      orders: { where: { restaurantId }, select: { createdAt: true } },
    },
  });
  let all = 0, repeat = 0, recent = 0;
  for (const c of customers) {
    if (c.orders.length === 0) continue;
    all++;
    if (c.orders.length >= 2) repeat++;
    if (c.orders.some((o) => o.createdAt >= since)) recent++;
  }
  return { all, repeat, recent };
}

// Send a WhatsApp blast to a guest segment. Counts against the venue's WhatsApp
// allowance (one metered send per recipient).
export async function sendCampaignAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { restaurantId } = await requireAdminWithPermission("analytics");
  if (!(await hasCapability(restaurantId, "whatsapp"))) {
    return { error: "WhatsApp campaigns need the Starter plan or higher." };
  }
  // Cap blasts per venue per day to limit spam/abuse (beyond the per-blast cap).
  if (!(await rateLimit(`campaign:${restaurantId}`, { windowMs: 24 * 60 * 60_000, max: 5 }))) {
    return { error: "You've reached today's campaign limit. Please try again tomorrow." };
  }
  const segment = String(formData.get("segment") ?? "all") as Segment;
  const message = String(formData.get("message") ?? "").trim().slice(0, 600);
  if (!message) return { error: "Write a message to send." };

  const since = new Date(Date.now() - 30 * DAY);
  const customers = await prisma.customer.findMany({
    where: { orders: { some: { restaurantId } } },
    select: {
      phone: true,
      orders: { where: { restaurantId }, select: { createdAt: true } },
    },
  });
  const recipients = customers
    .filter((c) => {
      if (c.orders.length === 0) return false;
      if (segment === "repeat") return c.orders.length >= 2;
      if (segment === "recent") return c.orders.some((o) => o.createdAt >= since);
      return true;
    })
    .map((c) => c.phone)
    .slice(0, MAX_RECIPIENTS);

  if (recipients.length === 0) return { error: "No guests match that segment yet." };

  const cfg = await prisma.onboardingConfig.findUnique({
    where: { restaurantId },
    select: { whatsappFrom: true },
  });

  let sent = 0;
  for (const phone of recipients) {
    const res = await sendWhatsAppFreeform(phone, message, cfg?.whatsappFrom);
    if (res.ok) {
      sent++;
      await recordUsage(restaurantId, "whatsapp");
    }
  }

  const me = await requireAdminWithPermission("analytics");
  await prisma.campaign.create({
    data: { restaurantId, segment, message, recipientCount: recipients.length, sentCount: sent, createdByName: me.name },
  });
  await recordAudit(restaurantId, me, "campaign.sent", `${segment} · ${sent}/${recipients.length}`);
  revalidatePath("/admin/customers");
  return { ok: true, message: `Campaign sent to ${sent} guest${sent === 1 ? "" : "s"}.` };
}
