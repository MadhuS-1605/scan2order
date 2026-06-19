"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createCouponAction,
  toggleCouponAction,
  deleteCouponAction,
} from "@/lib/coupons/actions";
import { Button, Input, Select, Field, Alert, Card } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";
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
  const tr = useT();
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <AddCouponForm />

      <Card>
        <h2 className="mb-3 font-semibold text-ink">{tr("coupons.yourCodes")} ({coupons.length})</h2>
        {coupons.length === 0 ? (
          <p className="text-sm text-ink/45">{tr("coupons.noCoupons")}</p>
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
                        {tr("coupons.inactive")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink/50">
                    {c.type === "PERCENT"
                      ? `${c.value}% ${tr("coupons.off")}`
                      : `${formatMoney(c.value, currency)} ${tr("coupons.off")}`}
                    {Number(c.minOrder) > 0 &&
                      ` · ${tr("coupons.min")} ${formatMoney(c.minOrder, currency)}`}
                    {c.maxDiscount &&
                      ` · ${tr("coupons.max")} ${formatMoney(c.maxDiscount, currency)}`}
                    {` · ${tr("coupons.used")} ${c.usedCount}${c.usageLimit ? `/${c.usageLimit}` : ""}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <form action={toggleCouponAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button size="sm" variant="secondary" type="submit">
                      {c.active ? tr("coupons.disable") : tr("coupons.enable")}
                    </Button>
                  </form>
                  <form action={deleteCouponAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button size="sm" variant="ghost" type="submit">
                      {tr("common.delete")}
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
  const tr = useT();
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
      <h2 className="mb-4 font-semibold text-ink">{tr("coupons.createCoupon")}</h2>
      <form ref={ref} action={action} className="space-y-3">
        {state.error && <Alert>{state.error}</Alert>}
        {state.ok && <Alert variant="success">{state.message}</Alert>}
        <Field label={tr("coupons.code")} htmlFor="c-code">
          <Input
            id="c-code"
            name="code"
            placeholder="WELCOME10"
            className="uppercase"
            required
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label={tr("coupons.type")} htmlFor="c-type">
            <Select id="c-type" name="type" defaultValue="PERCENT">
              <option value="PERCENT">{tr("coupons.percentOff")}</option>
              <option value="FLAT">{tr("coupons.flatOff")}</option>
            </Select>
          </Field>
          <Field label={tr("coupons.value")} htmlFor="c-value">
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
          <Field label={tr("coupons.minOrder")} htmlFor="c-min" hint={tr("common.optional")}>
            <Input id="c-min" name="minOrder" type="number" min="0" placeholder="0" />
          </Field>
          <Field label={tr("coupons.maxDiscount")} htmlFor="c-max" hint={tr("coupons.percentOnly")}>
            <Input id="c-max" name="maxDiscount" type="number" min="0" />
          </Field>
        </div>
        <Field label={tr("coupons.usageLimit")} htmlFor="c-limit" hint={tr("coupons.blankUnlimited")}>
          <Input id="c-limit" name="usageLimit" type="number" min="0" />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? tr("coupons.creating") : tr("coupons.createCoupon")}
        </Button>
      </form>
    </Card>
  );
}
