"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createVendorBillAction,
  markVendorBillRenewedAction,
  toggleVendorBillActiveAction,
  deleteVendorBillAction,
} from "@/lib/platform/vendor-bills";
import { Button, Input, Textarea, Select, Field, Alert, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

type Bill = {
  id: string;
  vendor: string;
  description: string | null;
  amount: string;
  currency: string;
  billingCycle: string;
  nextRenewalAt: string;
  autoRenews: boolean;
  paymentNote: string | null;
  isActive: boolean;
};

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  YEARLY: "Yearly",
  ONE_TIME: "One-time",
};

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function VendorBillsManager({ bills }: { bills: Bill[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddVendorBillForm />

      <Card className="p-0">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-sand-200 bg-sand-100/50 text-left text-xs uppercase tracking-wide text-ink/45">
            <tr>
              <th className="px-4 py-2.5">Vendor</th>
              <th className="px-4 py-2.5">Amount</th>
              <th className="px-4 py-2.5">Cycle</th>
              <th className="px-4 py-2.5">Next renewal</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-100">
            {bills.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink/45">No vendor bills tracked yet.</td></tr>
            ) : (
              bills.map((b) => {
                const days = daysUntil(b.nextRenewalAt);
                const overdue = days < 0;
                const soon = !overdue && days <= 7;
                return (
                  <tr key={b.id} className={b.isActive ? undefined : "opacity-50"}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-ink">{b.vendor}</span>
                      {b.description && <span className="block text-xs text-ink/50">{b.description}</span>}
                      {b.paymentNote && <span className="block text-xs text-ink/40">{b.paymentNote}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-ink/70">{formatMoney(b.amount, b.currency)}</td>
                    <td className="px-4 py-2.5 text-ink/70">
                      {CYCLE_LABEL[b.billingCycle] ?? b.billingCycle}
                      {b.autoRenews && <span className="ml-1 text-xs text-ink/40">(auto)</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          overdue
                            ? "rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
                            : soon
                              ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
                              : "text-ink/55"
                        }
                      >
                        {new Date(b.nextRenewalAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {overdue ? ` · overdue ${Math.abs(days)}d` : soon ? ` · ${days}d left` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap justify-end gap-2 text-xs">
                        <form action={markVendorBillRenewedAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <Button size="sm" variant="secondary" type="submit">Mark renewed</Button>
                        </form>
                        <form action={toggleVendorBillActiveAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <Button size="sm" variant="ghost" type="submit">{b.isActive ? "Deactivate" : "Reactivate"}</Button>
                        </form>
                        <form action={deleteVendorBillAction}>
                          <input type="hidden" name="id" value={b.id} />
                          <Button size="sm" variant="ghost" type="submit">Delete</Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function AddVendorBillForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createVendorBillAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <h2 className="mb-4 font-semibold text-ink">Add a vendor bill</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
        <Field label="Vendor" htmlFor="vb-vendor">
          <Input id="vb-vendor" name="vendor" placeholder="Razorpay" required />
        </Field>
        <Field label="Description" htmlFor="vb-desc" hint="Optional">
          <Textarea id="vb-desc" name="description" rows={2} placeholder="Payment gateway fees" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Amount" htmlFor="vb-amount">
            <Input id="vb-amount" name="amount" type="number" step="0.01" min="0" placeholder="999" required />
          </Field>
          <Field label="Currency" htmlFor="vb-currency">
            <Input id="vb-currency" name="currency" defaultValue="INR" maxLength={10} />
          </Field>
        </div>
        <Field label="Billing cycle" htmlFor="vb-cycle">
          <Select id="vb-cycle" name="billingCycle" defaultValue="MONTHLY">
            <option value="MONTHLY">Monthly</option>
            <option value="QUARTERLY">Quarterly</option>
            <option value="YEARLY">Yearly</option>
            <option value="ONE_TIME">One-time</option>
          </Select>
        </Field>
        <Field label="Next renewal date" htmlFor="vb-renewal">
          <Input id="vb-renewal" name="nextRenewalAt" type="date" required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="autoRenews" />
          Auto-renews (charged automatically)
        </label>
        <Field label="Payment note" htmlFor="vb-note" hint="Optional">
          <Input id="vb-note" name="paymentNote" placeholder="Auto-debit, company card ending 4242" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Adding…" : "Add vendor bill"}
        </Button>
      </form>
    </Card>
  );
}
