import { notFound } from "next/navigation";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber, modifierSummary, seatLabel } from "@/lib/utils";
import { LiveStream } from "@/components/live-stream";

// Customer-facing second screen for a table/counter: shows the running order
// as staff build it (via addOrderItemAction/setOrderItemQtyAction), live —
// so the guest sees pricing update the way a POS terminal's customer display
// would. Meant to be opened full-screen on a tablet/monitor facing the guest.
export default async function CustomerDisplayPage({
  params,
}: {
  params: Promise<{ tableId: string }>;
}) {
  const { tableId } = await params;
  const { restaurant, config } = await getCurrentRestaurant("orders");

  const table = await prisma.restaurantTable.findFirst({
    where: { id: tableId, restaurantId: restaurant.id },
  });
  if (!table) notFound();

  const order = await prisma.order.findFirst({
    where: {
      restaurantId: restaurant.id,
      tableId,
      status: { not: "CANCELLED" },
      paymentStatus: { not: "PAID" },
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const cur = config.currency;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center bg-ink px-6 py-10 text-center text-white">
      <LiveStream />
      <p className="text-sm uppercase tracking-[0.3em] text-white/50">{restaurant.name}</p>
      <h1 className="mt-1 font-display text-2xl">{seatLabel(table)}</h1>

      {!order || order.items.length === 0 ? (
        <p className="mt-16 font-display text-3xl text-white/60">Welcome!</p>
      ) : (
        <div className="mt-8 w-full max-w-md space-y-4">
          <ul className="space-y-2 text-left">
            {order.items.map((it) => (
              <li key={it.id} className="flex justify-between text-lg">
                <span>
                  {it.quantity}× {it.nameSnapshot}
                  {modifierSummary(it.modifiers) && (
                    <span className="block text-sm text-white/50">
                      {modifierSummary(it.modifiers)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 pl-4">{formatMoney(toNumber(it.lineTotal), cur)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/20 pt-4">
            <div className="flex justify-between text-sm text-white/60">
              <span>Subtotal</span>
              <span>{formatMoney(toNumber(order.subtotal), cur)}</span>
            </div>
            <div className="flex justify-between text-sm text-white/60">
              <span>Tax</span>
              <span>{formatMoney(toNumber(order.taxAmount), cur)}</span>
            </div>
            <div className="mt-2 flex justify-between font-display text-3xl">
              <span>Total</span>
              <span>{formatMoney(toNumber(order.totalAmount), cur)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
