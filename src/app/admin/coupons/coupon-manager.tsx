"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createCouponAction,
  toggleCouponAction,
  deleteCouponAction,
} from "@/lib/coupons/actions";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

type Coupon = {
  id: string;
  code: string;
  type: string;
  value: string;
  minOrder: string;
  maxDiscount: string | null;
  active: boolean;
  usageLimit: number | null;
  usedCount: number;
};

export function CouponManager({
  currency,
  coupons,
}: {
  currency: string;
  coupons: Coupon[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddCouponForm />

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Your codes ({coupons.length})</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-ink/45">No coupons yet.</p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-ink">
                    {c.code}
                    {!c.active && (
                      <span className="ml-2 rounded bg-sand-200 px-1.5 py-0.5 text-xs font-sans text-ink/55">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink/50">
                    {c.type === "PERCENT"
                      ? `${c.value}% off`
                      : `${formatMoney(c.value, currency)} off`}
                    {Number(c.minOrder) > 0 &&
                      ` · min ${formatMoney(c.minOrder, currency)}`}
                    {c.maxDiscount &&
                      ` · max ${formatMoney(c.maxDiscount, currency)}`}
                    {` · used ${c.usedCount}${c.usageLimit ? `/${c.usageLimit}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleCouponAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button size="sm" variant="secondary" type="submit">
                      {c.active ? "Disable" : "Enable"}
                    </Button>
                  </form>
                  <form action={deleteCouponAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button size="sm" variant="ghost" type="submit">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AddCouponForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    createCouponAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <Card className="h-fit">
      <h2 className="mb-4 font-semibold text-ink">Create a coupon</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.message}</Alert>}
        <Field label="Code" htmlFor="c-code">
          <Input
            id="c-code"
            name="code"
            placeholder="WELCOME10"
            className="uppercase"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Type" htmlFor="c-type">
            <Select id="c-type" name="type" defaultValue="PERCENT">
              <option value="PERCENT">% off</option>
              <option value="FLAT">Flat ₹ off</option>
            </Select>
          </Field>
          <Field label="Value" htmlFor="c-value">
            <Input
              id="c-value"
              name="value"
              type="number"
              step="0.01"
              min="0"
              placeholder="10"
              required
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min order (₹)" htmlFor="c-min" hint="Optional">
            <Input id="c-min" name="minOrder" type="number" min="0" placeholder="0" />
          </Field>
          <Field label="Max discount (₹)" htmlFor="c-max" hint="% only">
            <Input id="c-max" name="maxDiscount" type="number" min="0" />
          </Field>
        </div>
        <Field label="Usage limit" htmlFor="c-limit" hint="Blank = unlimited">
          <Input id="c-limit" name="usageLimit" type="number" min="0" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create coupon"}
        </Button>
      </form>
    </Card>
  );
}
