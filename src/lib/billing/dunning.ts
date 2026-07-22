import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendEmail, sendWhatsAppFreeform, sendWhatsAppTemplate } from "@/lib/messaging/provider";
import { notifyRestaurant } from "@/lib/push";
import { reportError } from "@/lib/observability";
import { notifyOps } from "@/lib/platform/alerts";
import { subscriptionState } from "@/lib/subscription";
import { escapeHtml } from "@/lib/utils";

// Dunning: remind owners whose trial/plan is about to lapse, or has just lapsed,
// so they renew. Run from the cron endpoint (api/cron/dunning). A per-restaurant
// cooldown (lastDunningAt) prevents daily repeats — at most one nudge per window.
// Owner notices are platform->tenant, so they are NOT metered.

const DAY = 86_400_000;
const billingUrl = () => `${env.appUrl.replace(/\/$/, "")}/admin/billing`;

async function notifyOwner(
  r: { id: string; name: string; email: string | null; phone: string | null },
  subject: string,
  body: string,
): Promise<void> {
  try {
    if (r.email) {
      const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#1c1917">
        <h2 style="margin:0 0 8px">${escapeHtml(subject)}</h2>
        <p style="margin:0 0 16px">${escapeHtml(body)}</p>
        <p style="margin:0 0 20px"><a href="${billingUrl()}" style="background:#d93d0b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Manage your plan</a></p>
        <p style="color:#999;font-size:12px;margin:0">Powered by Scan2Order</p>
      </div>`;
      await sendEmail(r.email, subject, html);
    }
    if (r.phone) {
      const tpl = env.messaging.meta.dunningTemplate;
      if (env.messaging.provider === "meta" && tpl) {
        // Billing URL is a static "Manage Subscription" button on the
        // approved template, not a body variable — no runtime param needed.
        await sendWhatsAppTemplate(r.phone, tpl, [r.name, `${subject}. ${body}`]);
      } else {
        await sendWhatsAppFreeform(r.phone, `${subject}. ${body} ${billingUrl()}`);
      }
    }
    await notifyRestaurant(r.id, { title: subject, body, url: "/admin/billing", tag: "billing-dunning" });
  } catch (e) {
    reportError("dunning.notify", e, { restaurantId: r.id });
    // reportError only reaches Sentry/stderr — this is a billing-critical
    // owner notice (trial ending / plan lapsed), so ping ops directly too
    // rather than relying on someone watching logs.
    await notifyOps(
      "Dunning notice failed to send",
      `Restaurant ${r.id} (${r.name}) — "${subject}" failed to send: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

export async function runDunning(now: Date = new Date()): Promise<{ notified: number }> {
  const soon = new Date(now.getTime() + 3 * DAY); // expiring within 3 days
  const recentlyLapsed = new Date(now.getTime() - 3 * DAY); // lapsed within last 3 days
  const cooldown = new Date(now.getTime() - 3 * DAY); // don't re-notify within 3 days

  const candidates = await prisma.restaurant.findMany({
    where: {
      planTier: { not: "FREE" },
      planActiveUntil: { gte: recentlyLapsed, lte: soon },
      OR: [{ lastDunningAt: null }, { lastDunningAt: { lt: cooldown } }],
    },
    select: { id: true, name: true, email: true, phone: true, planTier: true, planActiveUntil: true, planIsTrial: true },
  });

  let notified = 0;
  for (const r of candidates) {
    const sub = subscriptionState(r, now);
    const days = sub.daysLeft ?? 0;
    const dayWord = days === 1 ? "day" : "days";
    let subject: string | null = null;
    let body = "";
    if (sub.status === "TRIAL") {
      subject = `Your free trial ends in ${days} ${dayWord}`;
      body = `Subscribe before it ends to keep your paid features on ${r.name}.`;
    } else if (sub.status === "ACTIVE") {
      subject = `Your plan expires in ${days} ${dayWord}`;
      body = `Renew now so ${r.name} keeps its current plan without interruption.`;
    } else if (sub.status === "EXPIRED") {
      subject = `Your subscription has expired`;
      body = `${r.name} is now on Free-tier limits. Renew to restore your features.`;
    }
    if (!subject) continue;
    await notifyOwner(r, subject, body);
    await prisma.restaurant.update({ where: { id: r.id }, data: { lastDunningAt: now } });
    notified++;
  }
  return { notified };
}
