import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import {
  PROVIDERS,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type IntegrationCategory,
} from "@/lib/integrations/catalog";
import { ProviderCard } from "./integrations-cards";

export default async function IntegrationsPage() {
  const { restaurant } = await getCurrentRestaurant("settings");

  const existing = await prisma.integration.findMany({
    where: { restaurantId: restaurant.id },
  });
  const byProvider = new Map(existing.map((i) => [i.provider, i]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Integrations</h1>
        <p className="text-sm text-ink/45">
          Connect your POS, hotel PMS, accounting, SSO and webhooks. Webhooks fire
          live on order events; the rest store credentials ready to wire up.
        </p>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const providers = PROVIDERS.filter((p) => p.category === cat);
        if (providers.length === 0) return null;
        return (
          <section key={cat} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
              {CATEGORY_LABEL[cat as IntegrationCategory]}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((p) => {
                const row = byProvider.get(p.slug);
                return (
                  <ProviderCard
                    key={p.slug}
                    provider={p}
                    connected={Boolean(row?.enabled)}
                    config={(row?.config as Record<string, string>) ?? {}}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
