import { Download, ShoppingBag, Users, UtensilsCrossed, Star } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { Card } from "@/components/ui";

const EXPORTS = [
  { type: "orders", labelKey: "export.ordersLabel", descKey: "export.ordersDesc", icon: ShoppingBag },
  { type: "customers", labelKey: "export.customersLabel", descKey: "export.customersDesc", icon: Users },
  { type: "menu", labelKey: "export.menuLabel", descKey: "export.menuDesc", icon: UtensilsCrossed },
  { type: "feedback", labelKey: "export.feedbackLabel", descKey: "export.feedbackDesc", icon: Star },
];

export default async function ExportPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  await getCurrentRestaurant("analytics");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">
          {t(d, "export.title")}
        </h1>
        <p className="text-sm text-ink/45">
          {t(d, "export.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <Card key={e.type} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <e.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <p className="font-medium text-ink">{t(d, e.labelKey)}</p>
                <p className="text-xs text-ink/50">{t(d, e.descKey)}</p>
              </div>
            </div>
            <a
              href={`/api/export/${e.type}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Download className="h-4 w-4" />
              CSV
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
