import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card, Input, Button } from "@/components/ui";
import { openCashShiftAction, closeCashShiftAction } from "@/lib/cash/shift-actions";

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export default async function CashShiftsPage() {
  const { restaurant, session, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const openShift = await prisma.cashShift.findFirst({
    where: { restaurantId: restaurant.id, adminUserId: session.sub, closedAt: null },
  });
  const recent = await prisma.cashShift.findMany({
    where: { restaurantId: restaurant.id, closedAt: { not: null } },
    include: { adminUser: { select: { name: true } } },
    orderBy: { closedAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">Cash register</h1>

      {!openShift ? (
        <Card className="max-w-sm">
          <h2 className="mb-1 font-semibold text-ink">Open a shift</h2>
          <p className="mb-3 text-xs text-ink/45">Count the float in the drawer before you start.</p>
          <form action={openCashShiftAction} className="flex items-end gap-2">
            <div>
              <label className="block text-[10px] uppercase text-ink/45">Opening float ({cur})</label>
              <Input name="openingFloat" type="number" min="0" step="0.01" required className="w-32" />
            </div>
            <Button type="submit">Open</Button>
          </form>
        </Card>
      ) : (
        <Card className="max-w-lg">
          <h2 className="mb-1 font-semibold text-ink">Close shift</h2>
          <p className="mb-3 text-xs text-ink/45">
            Opened {openShift.openedAt.toLocaleString("en-IN")} with a float of{" "}
            {formatMoney(toNumber(openShift.openingFloat), cur)}. Count the drawer and enter each
            denomination below.
          </p>
          <form action={closeCashShiftAction} className="space-y-3">
            <input type="hidden" name="id" value={openShift.id} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {DENOMINATIONS.map((d) => (
                <div key={d}>
                  <label className="block text-[10px] uppercase text-ink/45">₹{d} ×</label>
                  <Input name={`denom_${d}`} type="number" min="0" step="1" className="w-full" />
                </div>
              ))}
            </div>
            <Button type="submit">Close shift</Button>
          </form>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl text-ink">Recent shifts</h2>
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-sand-100 text-left text-xs uppercase tracking-wide text-ink/45">
                <th className="p-3">Staff</th>
                <th className="p-3">Opened</th>
                <th className="p-3">Float</th>
                <th className="p-3">Expected</th>
                <th className="p-3">Counted</th>
                <th className="p-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => {
                const variance = toNumber(s.variance ?? 0);
                return (
                  <tr key={s.id} className="border-b border-sand-100 last:border-0">
                    <td className="p-3 font-medium text-ink">{s.adminUser.name}</td>
                    <td className="p-3 text-ink/60">{s.openedAt.toLocaleDateString("en-IN")}</td>
                    <td className="p-3 text-ink/60">{formatMoney(toNumber(s.openingFloat), cur)}</td>
                    <td className="p-3 text-ink/60">{formatMoney(toNumber(s.expectedCash ?? 0), cur)}</td>
                    <td className="p-3 text-ink/60">{formatMoney(toNumber(s.closingCounted ?? 0), cur)}</td>
                    <td className={`p-3 font-medium ${Math.abs(variance) < 0.01 ? "text-olive-700" : "text-red-600"}`}>
                      {variance >= 0 ? "+" : ""}
                      {formatMoney(variance, cur)}
                    </td>
                  </tr>
                );
              })}
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-ink/45">
                    No closed shifts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
