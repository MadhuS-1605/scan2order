"use client";

import { useState } from "react";
import { markPaidAction, clearTableAction } from "@/lib/orders/actions";
import { formatMoney } from "@/lib/utils";
import { ActionButton } from "@/components/admin/action-button";

// Per-occupied-table actions on the Floor view. "Settle & free" records payment;
// "Void & free" cancels the open orders, guarded by an inline confirm. Both give
// a toast + refresh via ActionButton.
export function FreeTableActions({
  tableId,
  anyOrderId,
  label,
  total,
  currency,
}: {
  tableId: string;
  anyOrderId: string;
  label: string;
  total: number;
  currency: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-3 flex flex-col gap-2">
      <ActionButton
        action={markPaidAction}
        fields={{ orderId: anyOrderId }}
        success={`${label} settled`}
        className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
      >
        Settle &amp; free
      </ActionButton>

      {confirming ? (
        <div className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-red-50 p-2">
          <p className="text-xs text-red-700">
            Void {label}&apos;s {formatMoney(total, currency)} bill? This cancels
            the orders.
          </p>
          <div className="flex gap-2">
            <ActionButton
              action={clearTableAction}
              fields={{ tableId }}
              success={`${label} cleared`}
              className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
            >
              Yes, void
            </ActionButton>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 rounded-md border border-sand-300 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-sand-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full rounded-lg border border-sand-300 bg-surface px-3 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-sand-100"
        >
          Void &amp; free
        </button>
      )}
    </div>
  );
}
