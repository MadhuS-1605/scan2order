import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { qrDataUrl, tableMenuUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/request";
import { deleteTableAction } from "@/lib/onboarding/actions";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { Card } from "@/components/ui";
import { QrPoster } from "@/components/admin/qr-poster";
import { AddTableForm, BulkAddTableForm, PrintButton } from "./tables-manager";

export default async function TablesPage() {
  const { restaurant, config } = await getCurrentRestaurant("tables");
  const baseUrl = await getBaseUrl();
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const selfService = config.serviceModel === "SELF_SERVICE";

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "asc" },
  });

  const withQr = await Promise.all(
    tables
      // Self-service shows only the single COUNTER (venue) QR; table service
      // shows the real tables and never the COUNTER pseudo-table.
      .filter((t) => (selfService ? t.kind === "COUNTER" : t.kind !== "COUNTER"))
      .map(async (t) => {
      const url = tableMenuUrl(
        baseUrl,
        // `||` (not `??`) so an empty-string subdomain falls back to the slug —
        // otherwise the QR host becomes "https://.<domain>/..." and is broken.
        restaurant.subdomain || restaurant.slug,
        t.label,
      );
      return {
        id: t.id,
        label: t.label,
        kind: t.kind,
        seats: t.seats,
        url,
        qr: await qrDataUrl(url),
      };
    }),
  );

  // Self-service venue: one venue-wide ordering QR, no tables to manage.
  if (selfService) {
    const qr = withQr[0];
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl font-medium text-ink">{t(d, "tables.orderingQr")}</h1>
          {qr && <PrintButton />}
        </div>
        <p className="max-w-prose text-sm text-ink/55">
          {t(d, "tables.selfServiceIntro")}
        </p>
        {qr ? (
          <Card id="qr-print-area" className="max-w-xs text-center">
            <QrPoster
              qr={qr.qr}
              restaurantName={restaurant.name}
              downloadFileName={`${restaurant.slug}-ordering-qr.png`}
              downloadLabel={t(d, "tables.downloadQr")}
            />
            <p className="mt-3 break-all text-[10px] text-ink/45">{qr.url}</p>
          </Card>
        ) : (
          <p className="text-sm text-ink/55">{t(d, "tables.qrBeingSetUp")}</p>
        )}
      </div>
    );
  }

  // Precomputed inside `.map` below the table item is named `t`, shadowing the
  // `t()` translate fn — so capture these strings up front.
  const dRoom = t(d, "tables.room");
  const dSeats = t(d, "tables.seats");
  const dDownload = t(d, "tables.download");
  const dRemove = t(d, "common.remove");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "tables.tablesAndQr")}</h1>
        {withQr.length > 0 && <PrintButton />}
      </div>

      <Card className="max-w-2xl">
        <h2 className="mb-3 font-semibold text-ink">{t(d, "tables.addTableOrRoom")}</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <AddTableForm />
          <BulkAddTableForm />
        </div>
      </Card>

      {withQr.length === 0 ? (
        <p className="text-sm text-ink/55">{t(d, "tables.noTablesYet")}</p>
      ) : (
        <div
          id="qr-print-area"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {withQr.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-sand-200 bg-surface p-4 text-center"
            >
              <QrPoster
                qr={t.qr}
                restaurantName={restaurant.name}
                tableLabel={t.kind === "ROOM" ? `${dRoom} ${t.label}` : t.label}
                downloadFileName={`${restaurant.slug}-qr-${t.label}.png`}
                downloadLabel={dDownload}
              />
              <p className="text-xs text-ink/55">
                {t.kind === "ROOM" && (
                  <span className="mr-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                    {dRoom}
                  </span>
                )}
                {t.seats} {dSeats}
              </p>
              <p className="mt-1 break-all text-[10px] text-ink/45">
                {t.url}
              </p>
              <div className="mt-2 flex justify-center print:hidden">
                <form action={deleteTableAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-red-600" type="submit">
                    {dRemove}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
