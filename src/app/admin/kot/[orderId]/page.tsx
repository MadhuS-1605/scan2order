import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { modifierSummary } from "@/lib/utils";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { AutoPrint } from "./auto-print";

// Thermal-width (80mm) kitchen ticket designed for the browser print dialog.
// Reachable from the kitchen board / orders list; auto-opens the print dialog.
export default async function KotPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const { restaurant } = await getCurrentRestaurant("kitchen");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId: restaurant.id },
    include: { table: true, items: true },
  });
  if (!order) notFound();

  const when = order.createdAt.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="kot-page mx-auto bg-white text-black">
      {/* Print on an 80mm thermal roll. Scoped to this page only (loaded in its
          own tab), so it never affects A4 prints like the QR-code sheet. */}
      <style>{`@media print { @page { size: 80mm auto; margin: 0; } }`}</style>
      <AutoPrint />
      <div className="mx-auto w-[80mm] max-w-full p-2 font-mono text-[13px] leading-tight">
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide">*** {t(d, "kot.kitchen")} ***</p>
          <p className="font-semibold">{restaurant.name}</p>
        </div>
        <hr className="my-2 border-t border-dashed border-black" />
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-extrabold">KOT #{order.orderNumber}</span>
          <span className="text-base font-bold">
            {order.table?.label ?? t(d, "kot.takeaway")}
          </span>
        </div>
        <p>{when}</p>
        {order.customerName && (
          <p>
            {t(d, "kot.customer")}: {order.customerName}
          </p>
        )}
        <hr className="my-2 border-t border-dashed border-black" />
        <ul className="space-y-1.5">
          {order.items.map((it) => {
            const mods = modifierSummary(it.modifiers);
            return (
              <li key={it.id}>
                <span className="font-bold">
                  {it.quantity}× {it.nameSnapshot}
                </span>
                {mods && <span className="block pl-4">{mods}</span>}
                {it.notes && (
                  <span className="block pl-4 font-semibold">&gt;&gt; {it.notes}</span>
                )}
              </li>
            );
          })}
        </ul>
        {order.notes && (
          <>
            <hr className="my-2 border-t border-dashed border-black" />
            <p className="font-semibold">{t(d, "kot.note")}: {order.notes}</p>
          </>
        )}
        <hr className="my-2 border-t border-dashed border-black" />
        <p className="no-print mt-3 text-center text-[11px] text-neutral-500">
          {t(d, "kot.reprintHint")}
        </p>
      </div>
    </div>
  );
}
