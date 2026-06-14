import Image from "next/image";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { qrDataUrl, tableMenuUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/request";
import { deleteTableAction } from "@/lib/onboarding/actions";
import { Card } from "@/components/ui";
import { AddTableForm, PrintButton } from "./tables-manager";

export default async function TablesPage() {
  const { restaurant } = await getCurrentRestaurant("tables");
  const baseUrl = await getBaseUrl();

  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "asc" },
  });

  const withQr = await Promise.all(
    tables.map(async (t) => {
      const url = tableMenuUrl(
        baseUrl,
        restaurant.subdomain ?? restaurant.slug,
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

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-medium text-ink">Tables &amp; QR</h1>
        {withQr.length > 0 && <PrintButton />}
      </div>

      <Card className="max-w-md">
        <h2 className="mb-3 font-semibold text-ink">Add a table or room</h2>
        <AddTableForm />
      </Card>

      {withQr.length === 0 ? (
        <p className="text-sm text-ink/55">No tables yet.</p>
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
              <Image
                src={t.qr}
                alt={`QR for ${t.label}`}
                width={180}
                height={180}
                unoptimized
                className="mx-auto h-44 w-44"
              />
              <p className="mt-2 font-semibold text-ink">
                {t.kind === "ROOM" ? `Room ${t.label}` : t.label}
              </p>
              <p className="text-xs text-ink/55">
                {t.kind === "ROOM" && (
                  <span className="mr-1 rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-600">
                    Room
                  </span>
                )}
                {t.seats} seats
              </p>
              <p className="mt-1 break-all text-[10px] text-ink/45">
                {t.url}
              </p>
              <div className="mt-2 flex justify-center gap-3 text-xs print:hidden">
                <a
                  href={t.qr}
                  download={`qr-${t.label}.png`}
                  className="font-medium text-brand-600"
                >
                  Download
                </a>
                <form action={deleteTableAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-red-600" type="submit">
                    Remove
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
