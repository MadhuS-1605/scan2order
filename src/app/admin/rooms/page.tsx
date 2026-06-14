import type { Prisma } from "@prisma/client";
import { BedDouble, Receipt } from "lucide-react";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { settleRoomAction } from "@/lib/rooms/actions";
import { formatMoney, toNumber } from "@/lib/utils";
import { round2 as r2 } from "@/lib/pricing";
import { LiveStream } from "@/components/live-stream";
import { Card } from "@/components/ui";
function payable(o: {
  totalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  tipAmount: Prisma.Decimal;
}) {
  return r2(
    Math.max(0, toNumber(o.totalAmount) - toNumber(o.discountAmount)) +
      toNumber(o.tipAmount),
  );
}

export default async function RoomsPage() {
  const { restaurant, config } = await getCurrentRestaurant("orders");

  const rooms = await prisma.restaurantTable.findMany({
    where: { restaurantId: restaurant.id, kind: "ROOM" },
    orderBy: { label: "asc" },
    include: {
      orders: {
        where: { paymentMethod: "ROOM", paymentStatus: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: { items: true },
      },
    },
  });

  const cur = config.currency;

  return (
    <div className="space-y-5">
      <LiveStream />
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">
          Rooms &amp; checkout
        </h1>
        <p className="text-sm text-ink/45">
          Open room-service charges. Settle a room&apos;s folio when the guest
          checks out.
        </p>
      </div>

      {rooms.length === 0 ? (
        <Card>
          <p className="text-sm text-ink/55">
            No rooms yet. Add rooms under{" "}
            <span className="font-medium text-ink/70">Tables &amp; QR</span> —
            choose “Hotel room” as the type — to put a QR in each room for
            in-room dining.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((room) => {
            const open = room.orders;
            const folio = r2(open.reduce((a, o) => a + payable(o), 0));
            return (
              <Card key={room.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      <BedDouble className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <div>
                      <p className="font-medium text-ink">Room {room.label}</p>
                      <p className="text-xs text-ink/45">
                        {open.length
                          ? `${open.length} open charge${open.length > 1 ? "s" : ""}`
                          : "No open charges"}
                      </p>
                    </div>
                  </div>
                  <p className="font-display text-xl text-ink">
                    {formatMoney(folio, cur)}
                  </p>
                </div>

                {open.length > 0 && (
                  <>
                    <ul className="space-y-1 border-t border-sand-100 pt-2 text-sm">
                      {open.map((o) => (
                        <li key={o.id} className="flex justify-between text-ink/70">
                          <span>
                            #{o.orderNumber} · {o.items.length} item
                            {o.items.length > 1 ? "s" : ""}
                          </span>
                          <span>{formatMoney(payable(o), cur)}</span>
                        </li>
                      ))}
                    </ul>
                    <form action={settleRoomAction}>
                      <input type="hidden" name="tableId" value={room.id} />
                      <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                      >
                        <Receipt className="h-4 w-4" />
                        Check out &amp; settle {formatMoney(folio, cur)}
                      </button>
                    </form>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
