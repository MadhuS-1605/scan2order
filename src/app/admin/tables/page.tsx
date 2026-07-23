import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { qrDataUrl, tableMenuUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/request";
import { deleteTableAction } from "@/lib/onboarding/actions";
import { createAreaAction, deleteAreaAction, assignTableAreaAction } from "@/lib/tables/area-actions";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { Card, Select, Input, Button } from "@/components/ui";
import { QrPoster } from "@/components/admin/qr-poster";
import { AddTableForm, BulkAddTableForm, PrintButton } from "./tables-manager";

export default async function TablesPage() {
  const { restaurant, config } = await getCurrentRestaurant("tables");
  const baseUrl = await getBaseUrl();
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const selfService = config.serviceModel === "SELF_SERVICE";

  const [tables, areas] = await Promise.all([
    prisma.restaurantTable.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tableArea.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  const areaNameById = new Map(areas.map((a) => [a.id, a.name]));

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
        areaId: t.areaId,
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
        <Card className="max-w-xs">
          <h2 className="mb-1 font-semibold text-ink">Self-service kiosk</h2>
          <p className="mb-2 text-xs text-ink/55">
            Pin a tablet&apos;s browser (in kiosk mode) to this URL for walk-up ordering with no QR scan needed.
          </p>
          <p className="break-all text-[10px] text-brand-600">
            {baseUrl}/kiosk/{restaurant.slug}
          </p>
        </Card>
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

      <Card className="max-w-2xl">
        <h2 className="mb-3 font-semibold text-ink">Areas / zones</h2>
        <p className="mb-3 text-xs text-ink/45">
          Group tables by section (e.g. Patio, Indoor, Rooftop) — purely organizational.
        </p>
        {areas.length > 0 && (
          <ul className="mb-3 flex flex-wrap gap-2">
            {areas.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-full border border-sand-300 bg-sand-100/40 px-3 py-1 text-sm text-ink/70"
              >
                {a.name}
                <form action={deleteAreaAction}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-ink/40 hover:text-red-600" aria-label={`Delete ${a.name}`}>
                    ×
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={createAreaAction} className="flex items-end gap-2">
          <Input name="name" placeholder="e.g. Patio" required className="w-48" />
          <Button size="sm" type="submit">Add area</Button>
        </form>
      </Card>

      {withQr.length === 0 ? (
        <p className="text-sm text-ink/55">{t(d, "tables.noTablesYet")}</p>
      ) : (
        (() => {
          const groups = new Map<string, typeof withQr>();
          for (const tbl of withQr) {
            const key = tbl.areaId ?? "";
            groups.set(key, [...(groups.get(key) ?? []), tbl]);
          }
          const orderedKeys = [
            ...areas.map((a) => a.id).filter((id) => groups.has(id)),
            ...(groups.has("") ? [""] : []),
          ];
          return (
            <div id="qr-print-area" className="space-y-6">
              {orderedKeys.map((key) => (
                <div key={key || "unassigned"}>
                  {areas.length > 0 && (
                    <h3 className="mb-3 text-sm font-semibold text-ink/60">
                      {key ? areaNameById.get(key) : "Unassigned"}
                    </h3>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groups.get(key)!.map((tbl) => (
                      <div
                        key={tbl.id}
                        className="rounded-2xl border border-sand-200 bg-surface p-4 text-center"
                      >
                        <QrPoster
                          qr={tbl.qr}
                          restaurantName={restaurant.name}
                          tableLabel={tbl.kind === "ROOM" ? `${dRoom} ${tbl.label}` : tbl.label}
                          downloadFileName={`${restaurant.slug}-qr-${tbl.label}.png`}
                          downloadLabel={dDownload}
                        />
                        <p className="text-xs text-ink/55">
                          {tbl.kind === "ROOM" && (
                            <span className="mr-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                              {dRoom}
                            </span>
                          )}
                          {tbl.seats} {dSeats}
                        </p>
                        <p className="mt-1 break-all text-[10px] text-ink/45">
                          {tbl.url}
                        </p>
                        {areas.length > 0 && (
                          <form
                            action={assignTableAreaAction}
                            className="mt-2 flex justify-center gap-1 print:hidden"
                          >
                            <input type="hidden" name="tableId" value={tbl.id} />
                            <Select name="areaId" defaultValue={tbl.areaId ?? ""} className="w-32 text-xs">
                              <option value="">Unassigned</option>
                              {areas.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                </option>
                              ))}
                            </Select>
                            <Button size="sm" variant="secondary" type="submit">
                              Set
                            </Button>
                          </form>
                        )}
                        <div className="mt-2 flex justify-center print:hidden">
                          <form action={deleteTableAction}>
                            <input type="hidden" name="id" value={tbl.id} />
                            <button className="text-red-600" type="submit">
                              {dRemove}
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()
      )}
    </div>
  );
}
