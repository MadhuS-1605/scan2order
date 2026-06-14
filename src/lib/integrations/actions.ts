"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { providerBySlug } from "@/lib/integrations/catalog";
import { sendTestWebhook } from "@/lib/integrations/webhooks";

async function requireSettingsAdmin() {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "settings")) throw new Error("Not allowed");
  return session;
}

// Save credentials + enable a provider.
export async function connectIntegrationAction(formData: FormData): Promise<void> {
  const session = await requireSettingsAdmin();
  const provider = String(formData.get("provider") ?? "");
  const def = providerBySlug(provider);
  if (!def) return;

  const config: Record<string, string> = {};
  for (const f of def.fields) {
    const v = String(formData.get(`field_${f.key}`) ?? "").trim();
    if (v) config[f.key] = v;
  }

  await prisma.integration.upsert({
    where: { restaurantId_provider: { restaurantId: session.restaurantId, provider } },
    create: {
      restaurantId: session.restaurantId,
      provider,
      category: def.category,
      enabled: true,
      config,
    },
    update: { enabled: true, config, category: def.category },
  });
  await recordAudit(session.restaurantId, session, "integration.connected", def.name);
  revalidatePath("/admin/integrations");
}

export async function disconnectIntegrationAction(formData: FormData): Promise<void> {
  const session = await requireSettingsAdmin();
  const provider = String(formData.get("provider") ?? "");
  const def = providerBySlug(provider);
  await prisma.integration.updateMany({
    where: { restaurantId: session.restaurantId, provider },
    data: { enabled: false },
  });
  await recordAudit(
    session.restaurantId,
    session,
    "integration.disconnected",
    def?.name ?? provider,
  );
  revalidatePath("/admin/integrations");
}

// Fire a sample payload at the configured webhook so the operator can confirm it.
export async function testWebhookAction(): Promise<{
  ok: boolean;
  status?: number;
  error?: string;
}> {
  const session = await requireSettingsAdmin();
  const integ = await prisma.integration.findUnique({
    where: {
      restaurantId_provider: { restaurantId: session.restaurantId, provider: "webhook" },
    },
  });
  const cfg = (integ?.config ?? {}) as { url?: string; secret?: string };
  if (!cfg.url) return { ok: false, error: "Save a webhook URL first." };
  return sendTestWebhook(cfg.url, cfg.secret);
}
