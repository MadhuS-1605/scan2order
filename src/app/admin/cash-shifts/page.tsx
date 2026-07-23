import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card, Input, Button, Select } from "@/components/ui";
import {
  openCashShiftAction,
  closeCashShiftAction,
  createRegisterAction,
  deleteRegisterAction,
} from "@/lib/cash/shift-actions";
import { hasPermission } from "@/lib/auth/permissions";

const DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

export default async function CashShiftsPage() {
  const { restaurant, session, config } = await getCurrentRestaurant("orders");
  const cur = config.currency;

  const [openShift, recent, registers] = await Promise.all([
    prisma.cashShift.findFirst({
      where: { restaurantId: restaurant.id, adminUserId: session.sub, closedAt: null },
    }),
    prisma.cashShift.findMany({
      where: { restaurantId: restaurant.id, closedAt: { not: null } },
      include: { adminUser: { select: { name: true } }, register: { select: { name: true } } },
      orderBy: { closedAt: "desc" },
      take: 20,
    }),
    prisma.register.findMany({ where: { restaurantId: restaurant.id }, orderBy: { name: "asc" } }),
  ]);

  const canManageRegisters = hasPermission(session.role, "settings");

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">Cash register</h1>

      {canManageRegisters && (
        <Card className="max-w-sm">
          <h2 className="mb-1 font-semibold text-ink">Registers / counters</h2>
          <p className="mb-2 text-xs text-ink/45">
            Name each billing counter so multiple staff can run simultaneous shifts on separate
            registers.
          </p>
          {registers.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {registers.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-full border border-sand-300 bg-sand-100/40 px-3 py-1 text-sm text-ink/70"
                >
                  {r.name}
                  <form action={deleteRegisterAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-ink/40 hover:text-red-600">
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={createRegisterAction} className="flex items-end gap-2">
            <Input name="name" placeholder="e.g. Front Counter" required className="w-40" />
            <Button size="sm" type="submit">Add</Button>
          </form>
        </Card>
      )}

      {!openShift ? (
        <Card className="max-w-sm">
          <h2 className="mb-1 font-semibold text-ink">Open a shift</h2>
          <p className="mb-3 text-xs text-ink/45">Count the float in the drawer before you start.</p>
          <form action={openCashShiftAction} className="flex items-end gap-2">
            {registers.length > 0 && (
              <div>
                <label className="block text-[10px] uppercase text-ink/45">Register</label>
                <Select name="registerId" className="w-36">
                  {registers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
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
                <th className="p-3">Register</th>
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
                    <td className="p-3 text-ink/60">{s.register?.name ?? "—"}</td>
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
                  <td colSpan={7} className="p-6 text-center text-ink/45">
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
