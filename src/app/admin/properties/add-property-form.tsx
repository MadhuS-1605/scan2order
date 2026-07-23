"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPropertyAction } from "@/lib/properties/actions";
import { Card, Field, Input, Select, Button, Alert } from "@/components/ui";
import { useT } from "@/components/admin/i18n-provider";

export function AddPropertyForm() {
  const tr = useT();
  const [state, action, pending] = useActionState(createPropertyAction, {});

  return (
    <Card>
      <div className="mb-3 flex items-center gap-2">
        <Plus className="h-4 w-4 text-brand-600" />
        <h2 className="font-medium text-ink">{tr("properties.addProperty")}</h2>
      </div>
      <p className="mb-4 text-sm text-ink/50">
        {tr("properties.addPropertyHint")}
      </p>
      {state?.error && <Alert variant="error">{state.error}</Alert>}
      <form action={action} className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label={tr("properties.propertyName")} htmlFor="p-name">
            <Input
              id="p-name"
              name="name"
              placeholder="Spice Garden — Koramangala"
              required
            />
          </Field>
        </div>
        <Field label={tr("properties.type")} htmlFor="p-type">
          <Select id="p-type" name="type" defaultValue="RESTAURANT">
            <option value="RESTAURANT">{tr("properties.typeRestaurant")}</option>
            <option value="CAFE">{tr("properties.typeCafe")}</option>
            <option value="HOTEL">{tr("properties.typeHotel")}</option>
            <option value="CLOUD_KITCHEN">{tr("properties.typeCloudKitchen")}</option>
            <option value="BAR">{tr("properties.typeBar")}</option>
            <option value="QSR">{tr("properties.typeQsr")}</option>
            <option value="BAKERY">{tr("properties.typeBakery")}</option>
            <option value="PIZZERIA">{tr("properties.typePizzeria")}</option>
            <option value="BURGER_JOINT">{tr("properties.typeBurgerJoint")}</option>
            <option value="OTHER">{tr("properties.typeOther")}</option>
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr("properties.cityOptional")} htmlFor="p-city">
            <Input id="p-city" name="city" placeholder="Bengaluru" />
          </Field>
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? tr("properties.creating") : tr("properties.createAndSwitch")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
