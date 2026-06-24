import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail, sendWhatsApp, sendWhatsAppTemplate } from "@/lib/messaging/provider";
import { notifyRestaurant } from "@/lib/push";
import { reportError } from "@/lib/observability";
import { formatMoney, escapeHtml } from "@/lib/utils";
import type { UsageChannel } from "@/lib/plans";

// Owner-facing billing notices for usage overage, delivered on up to three
// channels: email, WhatsApp, and web push. These go to the RESTAURANT OWNER
// (platform -> tenant), so they are NOT metered (recordUsage is never called
// here) — that also avoids a notify→usage→notify loop. All sends are fail-soft:
// a notification problem must never break a send or a payment.
//
// WhatsApp: on the Meta provider, business-initiated messages require a
// pre-approved template, so we use one when configured (env.messaging.meta
// .overage*Template); otherwise we fall back to the free-form sender (console
// when unconfigured).

const CHANNEL_LABEL: Record<UsageChannel, string> = {
  whatsapp: "WhatsApp messages",
  email: "bill emails",
};

const billingUrl = () => `${env.appUrl.replace(/\/$/, "")}/admin/billing`;

// Deliver an owner WhatsApp via the Meta template when available, else free-form.
async function ownerWhatsApp(
  phone: string,
  freeFormText: string,
  template: string,
  params: string[],
): Promise<void> {
  if (env.messaging.provider === "meta" && template) {
    await sendWhatsAppTemplate(phone, template, params);
  } else {
    await sendWhatsApp(phone, freeFormText);
  }
}

async function owner(restaurantId: string) {
  return prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, email: true, phone: true },
  });
}

function wrap(title: string, body: string): string {
  // Escape — callers pass server-authored text today, but keep the helper safe.
  return `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
    <h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
    <p style="margin:0 0 16px">${escapeHtml(body)}</p>
    <p style="margin:0 0 20px"><a href="${billingUrl()}" style="background:#d93d0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">View usage &amp; billing</a></p>
    <p style="color:#999;font-size:12px;margin:0">Powered by Scan to Order</p>
  </div>`;
}

// Fired once per channel per month when usage crosses 80% / 100% of the plan
// allowance (see recordUsage threshold tracking).
export async function notifyOverageThreshold(
  restaurantId: string,
  channel: UsageChannel,
  pct: number,
  used: number,
  allowance: number,
): Promise<void> {
  try {
    const r = await owner(restaurantId);
    if (!r) return;
    const label = CHANNEL_LABEL[channel];
    const subject =
      pct >= 100
        ? `You've used all your included ${label}`
        : `You're at ${pct}% of your included ${label}`;
    const body =
      pct >= 100
        ? `Your venue has used ${used} of ${allowance} included ${label} this month. Additional ${label} are now billed as overage — see your billing page to review and settle.`
        : `Your venue has used ${used} of ${allowance} included ${label} this month (${pct}%). Beyond your monthly allowance, ${label} are billed as overage.`;
    if (r.email) await sendEmail(r.email, subject, wrap(subject, body));
    if (r.phone) {
      await ownerWhatsApp(
        r.phone,
        `${subject}. ${body} ${billingUrl()}`,
        env.messaging.meta.overageAlertTemplate,
        [r.name, `${used} of ${allowance} ${label} (${pct}%)`, billingUrl()],
      );
    }
    await notifyRestaurant(restaurantId, {
      title: subject,
      body,
      url: "/admin/billing",
      tag: "billing-usage",
    });
  } catch (e) {
    reportError("overage.notifyThreshold", e, { restaurantId, channel, pct });
  }
}

// Fired after overage is successfully settled (standalone or bundled).
export async function notifyOverageSettled(
  restaurantId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  try {
    const r = await owner(restaurantId);
    if (!r) return;
    const amt = formatMoney(amount);
    const subject = `Payment received — usage overage ${amt}`;
    const body = `We've received your usage overage payment of ${amt}. Thank you! Your account is up to date.`;
    if (r.email) await sendEmail(r.email, subject, wrap(subject, body));
    if (r.phone) {
      await ownerWhatsApp(
        r.phone,
        `${subject}. ${body}`,
        env.messaging.meta.overagePaidTemplate,
        [r.name, amt, billingUrl()],
      );
    }
    await notifyRestaurant(restaurantId, {
      title: subject,
      body,
      url: "/admin/billing",
      tag: "billing-usage",
    });
  } catch (e) {
    reportError("overage.notifySettled", e, { restaurantId, amount });
  }
}
