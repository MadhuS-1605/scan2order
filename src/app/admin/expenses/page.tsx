import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { formatMoney, toNumber } from "@/lib/utils";
import { Card, Input, Button, Select } from "@/components/ui";
import { createExpenseAction, deleteExpenseAction } from "@/lib/expenses/actions";

const CATEGORIES = ["Rent", "Utilities", "Supplies", "Salaries", "Maintenance", "Marketing", "Other"];

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { restaurant, config } = await getCurrentRestaurant("settings");
  const { days: daysParam } = await searchParams;
  const days = Math.max(1, Math.min(365, Number(daysParam) || 30));
  const since = new Date(Date.now() - days * 86_400_000);

  const expenses = await prisma.expense.findMany({
    where: { restaurantId: restaurant.id, incurredAt: { gte: since } },
    orderBy: { incurredAt: "desc" },
  });
  const total = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + toNumber(e.amount));
  }
  const cur = config.currency;

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">Expenses</h1>

      <div className="flex gap-2 text-sm">
        {[7, 30, 90, 365].map((n) => (
          <a
            key={n}
            href={`/admin/expenses?days=${n}`}
            className={`rounded-lg border px-3 py-1.5 ${
              days === n ? "border-brand-400 bg-brand-50 text-brand-700" : "border-sand-300 text-ink/60"
            }`}
          >
            {n === 365 ? "1y" : `${n}d`}
          </a>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase tracking-wide text-ink/45">Total ({days}d)</p>
          <p className="mt-1 font-display text-2xl text-ink">{formatMoney(total, cur)}</p>
        </Card>
        <Card>
          <p className="mb-1 text-xs uppercase tracking-wide text-ink/45">By category</p>
          <div className="space-y-0.5 text-sm">
            {[...byCategory.entries()].map(([cat, amt]) => (
              <div key={cat} className="flex justify-between text-ink/70">
                <span>{cat}</span>
                <span>{formatMoney(amt, cur)}</span>
              </div>
            ))}
            {byCategory.size === 0 && <p className="text-ink/40">No expenses logged yet.</p>}
          </div>
        </Card>
      </div>

      <Card className="max-w-xl">
        <h2 className="mb-3 font-semibold text-ink">Log an expense</h2>
        <form action={createExpenseAction} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] uppercase text-ink/45">Category</label>
            <Select name="category" className="w-36" required defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-[10px] uppercase text-ink/45">Amount ({cur})</label>
            <Input name="amount" type="number" min="0.01" step="0.01" required className="w-28" />
          </div>
          <div>
            <label className="block text-[10px] uppercase text-ink/45">Date</label>
            <Input name="incurredAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-40" />
          </div>
          <div className="min-w-[10rem] flex-1">
            <label className="block text-[10px] uppercase text-ink/45">Note (optional)</label>
            <Input name="note" placeholder="e.g. June electricity bill" />
          </div>
          <Button type="submit">Add</Button>
        </form>
      </Card>

      <Card className="p-0">
        <ul className="divide-y divide-sand-100">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 p-4 text-sm">
              <span className="text-ink/70">
                <span className="font-medium text-ink">{e.category}</span> · {formatMoney(toNumber(e.amount), cur)}
                {e.note ? ` · ${e.note}` : ""} · {e.incurredAt.toLocaleDateString("en-IN")}
              </span>
              <form action={deleteExpenseAction}>
                <input type="hidden" name="id" value={e.id} />
                <Button size="sm" variant="ghost" type="submit">
                  Delete
                </Button>
              </form>
            </li>
          ))}
          {expenses.length === 0 && (
            <li className="p-6 text-center text-sm text-ink/45">No expenses in this period.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
