"use client";

import { useActionState } from "react";
import { refundOrderAction, type RefundResult } from "@/lib/orders/actions";
import { Button, Input, Alert } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";

// Staff refund form. Defaults to the full refundable amount; allow a smaller
// (partial) amount. Online payments refund via Razorpay; otherwise it records a
// manual refund note.
export function RefundForm({
  orderId,
  refundable,
  currency,
  online,
}: {
  orderId: string;
  refundable: number;
  currency: string;
  online: boolean;
}) {
  const tr = useT();
  const [state, action, pending] = useActionState<RefundResult | null, FormData>(
    async (_prev, fd) => refundOrderAction(fd),
    null,
  );

  if (state?.ok) {
    return (
      <p className="text-sm font-medium text-olive-700">
        ✓ {tr("refund.refunded")} {currency} {state.amount.toFixed(2)}
        {online ? ` ${tr("refund.viaGateway")}` : ` ${tr("refund.recordedNote")}`}
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      {state && !state.ok && <Alert>{state.error}</Alert>}
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/55">
            {tr("refund.amount")} ({currency})
          </span>
          <Input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            max={refundable}
            defaultValue={refundable.toFixed(2)}
            className="w-32"
          />
        </label>
        <label className="flex-1 text-sm">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink/55">
            {tr("refund.reason")} ({tr("common.optional")})
          </span>
          <Input name="reason" placeholder={tr("refund.reasonPlaceholder")} />
        </label>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending
            ? tr("refund.refunding")
            : online
              ? tr("refund.refundOnline")
              : tr("refund.recordRefund")}
        </Button>
      </div>
      <p className="text-xs text-ink/45">
        {`${tr("refund.upTo")} ${currency} ${refundable.toFixed(2)} ${tr("refund.refundableSuffix")}`}
        {online ? ` ${tr("refund.gatewayHint")}` : ` ${tr("refund.manualHint")}`}
      </p>
    </form>
  );
}
