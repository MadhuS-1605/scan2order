import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card, Input, Button, Select, StatusBadge } from "@/components/ui";
import { hasPermission } from "@/lib/auth/permissions";
import {
  createRiderAction,
  deactivateRiderAction,
  assignRiderAction,
  advanceDeliveryStatusAction,
} from "@/lib/delivery/actions";

const NEXT_LABEL: Record<string, string> = {
  ASSIGNED: "Out for delivery",
  OUT_FOR_DELIVERY: "Mark delivered",
};

export default async function DeliveryPage() {
  const { restaurant, session, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const [orders, riders] = await Promise.all([
    prisma.order.findMany({
      where: {
        restaurantId: restaurant.id,
        fulfillment: "DELIVERY",
        deliveryStatus: { not: "DELIVERED" },
        status: { not: "CANCELLED" },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deliveryRider.findMany({
      where: { restaurantId: restaurant.id, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const canManageRiders = hasPermission(session.role, "settings");

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">Delivery</h1>

      {canManageRiders && (
        <Card className="max-w-md">
          <h2 className="mb-1 font-semibold text-ink">Delivery riders</h2>
          {riders.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {riders.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-full border border-sand-300 bg-sand-100/40 px-3 py-1 text-sm text-ink/70"
                >
                  {r.name}
                  <form action={deactivateRiderAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-ink/40 hover:text-red-600">
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={createRiderAction} className="flex items-end gap-2">
            <Input name="name" placeholder="Rider name" required className="w-36" />
            <Input name="phone" placeholder="Phone" className="w-32" />
            <Button size="sm" type="submit">Add</Button>
          </form>
        </Card>
      )}

      <Card className="p-0">
        <ul className="divide-y divide-sand-100">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-ink">
                  #{o.orderNumber} · {formatMoney(toNumber(o.totalAmount), cur)}
                </p>
                <p className="text-xs text-ink/45">{o.deliveryAddress}</p>
                {o.deliveryStatus && <StatusBadge status={o.deliveryStatus} />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <form action={assignRiderAction} className="flex items-center gap-1">
                  <input type="hidden" name="orderId" value={o.id} />
                  <Select name="riderId" defaultValue={o.deliveryRiderId ?? ""} className="w-36 text-sm">
                    <option value="">Unassigned</option>
                    {riders.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" type="submit">
                    Assign
                  </Button>
                </form>
                {o.deliveryStatus && NEXT_LABEL[o.deliveryStatus] && (
                  <form action={advanceDeliveryStatusAction}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <Button size="sm" type="submit">
                      {NEXT_LABEL[o.deliveryStatus]}
                    </Button>
                  </form>
                )}
              </div>
            </li>
          ))}
          {orders.length === 0 && (
            <li className="p-6 text-center text-sm text-ink/45">No active deliveries.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
