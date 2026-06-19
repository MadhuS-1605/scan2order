import Link from "next/link";
import { Sparkles, Download, RotateCcw } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCustomerSession } from "@/lib/customer/session";
import { DeleteDataButton } from "./delete-data-button";
import { formatMoney, toNumber, modifierSummary } from "@/lib/utils";
import { StatusBadge } from "@/components/ui";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import {
  logoutAccountAction,
  updateCustomerNameAction,
} from "@/lib/account/actions";
import { AccountLogin } from "./login";

export const metadata = { title: "Your orders" };

export default async function AccountPage() {
  const session = await getCustomerSession();

  if (!session) {
    return (
      <div className="min-h-screen bg-grain">
        <div className="mx-auto max-w-lg px-4 py-10">
          <AccountLogin />
        </div>
      </div>
    );
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.customerId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 30,
        include: { restaurant: true, table: true, items: true },
      },
    },
  });

  if (!customer) {
    return (
      <div className="min-h-screen bg-grain">
        <div className="mx-auto max-w-lg px-4 py-10">
          <AccountLogin />
        </div>
      </div>
    );
  }

  // Favourites — most-ordered items by quantity.
  const fav = new Map<string, number>();
  for (const o of customer.orders)
    for (const it of o.items)
      fav.set(it.nameSnapshot, (fav.get(it.nameSnapshot) ?? 0) + it.quantity);
  const favourites = [...fav.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const visits = customer.orders.length;
  const spent = customer.orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + toNumber(o.totalAmount), 0);

  return (
    <div className="min-h-screen bg-grain">
      <div className="mx-auto max-w-lg space-y-4 px-4 py-6 pb-24 sm:py-8 sm:pb-24">
        {/* Profile + loyalty */}
        <div className="rounded-2xl border border-sand-200 bg-surface p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-display text-2xl text-ink">
                {customer.name ? `Hi, ${customer.name}` : "Your account"}
              </h1>
              <p className="text-sm text-ink/55">{customer.phone}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <form action={logoutAccountAction}>
                <button className="text-sm text-ink/50 hover:text-ink" type="submit">
                  Sign out
                </button>
              </form>
              <DeleteDataButton />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Points" value={String(customer.loyaltyPoints)} accent />
            <Stat label="Visits" value={String(visits)} />
            <Stat label="Spent" value={formatMoney(spent)} />
          </div>

          {!customer.name && (
            <form action={updateCustomerNameAction} className="mt-3 flex gap-2">
              <input
                name="name"
                placeholder="Add your name"
                className="flex-1 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm"
              />
              <button
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                type="submit"
              >
                Save
              </button>
            </form>
          )}
        </div>

        {favourites.length > 0 && (
          <div className="rounded-2xl border border-sand-200 bg-surface p-5">
            <h2 className="mb-2 flex items-center gap-1.5 font-display text-lg text-ink">
              <Sparkles className="h-4 w-4 text-brand-600" />
              Your favourites
            </h2>
            <div className="flex flex-wrap gap-2">
              {favourites.map(([name, qty]) => (
                <span
                  key={name}
                  className="rounded-full bg-sand-100 px-3 py-1 text-sm text-ink/75"
                >
                  {name} <span className="text-ink/40">×{qty}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="mb-2 font-display text-lg text-ink">Order history</h2>
          {customer.orders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-sand-300 bg-surface p-8 text-center text-sm text-ink/55">
              No orders yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {customer.orders.map((o) => (
                <li
                  key={o.id}
                  className="rounded-2xl border border-sand-200 bg-surface p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">
                        {o.restaurant.name}
                      </p>
                      <p className="text-xs text-ink/45">
                        {o.createdAt.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        · #{o.orderNumber}
                      </p>
                    </div>
                    <StatusBadge status={o.status} />
                  </div>

                  <ul className="mt-2 text-sm text-ink/70">
                    {o.items.map((it) => (
                      <li key={it.id}>
                        {it.quantity}× {it.nameSnapshot}
                        {modifierSummary(it.modifiers) && (
                          <span className="text-ink/45">
                            {" "}
                            ({modifierSummary(it.modifiers)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-3 flex items-center justify-between border-t border-sand-100 pt-3">
                    <span className="text-sm font-semibold text-ink">
                      {formatMoney(toNumber(o.totalAmount))}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      {o.table && (
                        <a
                          href={`/api/bill/${o.id}/pdf?t=${o.table.qrToken}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-ink/60 hover:text-ink"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Bill
                        </a>
                      )}
                      {o.table && (
                        <Link
                          href={`/t/${o.table.qrToken}?reorder=${o.id}`}
                          className="inline-flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reorder
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <CustomerTabBar />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl bg-sand-100 px-2 py-3">
      <p
        className={`font-display text-xl ${accent ? "text-brand-600" : "text-ink"}`}
      >
        {value}
      </p>
      <p className="text-xs uppercase tracking-wide text-ink/45">{label}</p>
    </div>
  );
}
