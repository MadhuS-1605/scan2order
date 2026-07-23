"use client";

import { useActionState } from "react";
import { approveRefundAction, rejectRefundAction, type RefundResult } from "@/lib/orders/actions";
import { Button, Alert } from "@/components/ui";

export function ApproveRejectForm({ refundId }: { refundId: string }) {
  const [state, approve, pending] = useActionState<RefundResult | null, FormData>(
    async (_prev, fd) => approveRefundAction(fd),
    null,
  );

  if (state?.ok) {
    return <p className="text-sm font-medium text-olive-700">✓ Approved</p>;
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={approve}>
          <input type="hidden" name="refundId" value={refundId} />
          <Button size="sm" type="submit" disabled={pending}>
            Approve
          </Button>
        </form>
        <form action={rejectRefundAction}>
          <input type="hidden" name="refundId" value={refundId} />
          <Button size="sm" variant="ghost" type="submit">
            Decline
          </Button>
        </form>
      </div>
      {state && !state.ok && <Alert>{state.error}</Alert>}
    </div>
  );
}
