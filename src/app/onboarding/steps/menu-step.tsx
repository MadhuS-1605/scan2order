"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addCategoryAction,
  addMenuItemAction,
  deleteMenuItemAction,
  gotoStepAction,
} from "@/lib/onboarding/actions";
import { importMenuCsvAction } from "@/lib/menu/actions";
import { Button, Input, Textarea, Select, Field, Alert, Card, VegMark } from "@/components/ui";
import { ImageUpload } from "@/components/admin/image-upload";
import { formatMoney } from "@/lib/utils";
import type { ActionState } from "@/lib/validation";

type Category = { id: string; name: string };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  categoryId: string | null;
  isVeg: boolean;
  isAvailable: boolean;
  isSpecialOfDay: boolean;
  availableFrom: string | null;
  availableTo: string | null;
};

export function MenuStep({
  categories,
  items,
}: {
  categories: Category[];
  items: Item[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-2xl text-ink">Build your menu</h2>
        <p className="mt-1 text-sm text-ink/55">
          Add categories, then dishes with prices and availability.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <AddCategoryForm />
          <AddItemForm categories={categories} />
        </div>
      </Card>

      <ImportCsv />

      <Card>
        <h3 className="font-semibold text-ink">
          Menu items ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink/55">No items yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-sand-100">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between py-3"
              >
                <div className="flex items-center gap-2">
                  <VegMark isVeg={item.isVeg} />
                  <div>
                    <p className="text-sm font-medium text-ink">
                      {item.name}
                      {item.isSpecialOfDay && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                          Special
                        </span>
                      )}
                      {!item.isAvailable && (
                        <span className="ml-2 rounded bg-sand-100 px-1.5 py-0.5 text-xs text-ink/55">
                          Unavailable
                        </span>
                      )}
                    </p>
                    {(item.availableFrom || item.description) && (
                      <p className="text-xs text-ink/55">
                        {item.description}
                        {item.availableFrom &&
                          ` · ${item.availableFrom}–${item.availableTo}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-ink/80">
                    {formatMoney(item.price)}
                  </span>
                  <form action={deleteMenuItemAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button variant="ghost" size="sm" type="submit">
                      Remove
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <form action={gotoStepAction.bind(null, "profile")}>
          <Button variant="secondary" type="submit">
            Back
          </Button>
        </form>
        <form action={gotoStepAction.bind(null, "settings")}>
          <Button type="submit" size="lg" disabled={items.length === 0}>
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}

function ImportCsv() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    importMenuCsvAction,
    {},
  );
  return (
    <Card>
      <details className="group">
        <summary className="cursor-pointer list-none font-medium text-ink">
          Already have a menu? Paste it in bulk instead
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink/55">
            CSV with a header row: name, price, category, description, veg (yes/no). One row per dish.
          </p>
          {state.error && <Alert>{state.error}</Alert>}
          {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
          <form action={action} className="space-y-2">
            <Textarea
              name="csv"
              rows={6}
              placeholder={"name,price,category,description,veg\nMargherita,250,Pizza,Classic cheese,yes"}
              className="font-mono text-xs"
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </Button>
          </form>
        </div>
      </details>
    </Card>
  );
}

function AddCategoryForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addCategoryAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      <Field label="Add category" htmlFor="cat-name">
        <div className="flex gap-2">
          <Input id="cat-name" name="name" placeholder="Starters" required />
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </div>
      </Field>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

function AddItemForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    addMenuItemAction,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="space-y-3">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Item name" htmlFor="item-name">
          <Input id="item-name" name="name" placeholder="Paneer Tikka" required />
        </Field>
        <Field label="Price (₹)" htmlFor="item-price">
          <Input
            id="item-price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            placeholder="180"
            required
          />
        </Field>
      </div>
      <Field label="Category" htmlFor="item-cat">
        <Select id="item-cat" name="categoryId" defaultValue="">
          <option value="">Uncategorised</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="item-desc">
        <Textarea
          id="item-desc"
          name="description"
          rows={2}
          placeholder="Char-grilled cottage cheese with spices"
        />
      </Field>
      <Field label="Image" htmlFor="item-img" hint="Optional">
        <ImageUpload name="imageUrl" kind="menu" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Available from" htmlFor="item-from" hint="Optional">
          <Input id="item-from" name="availableFrom" type="time" />
        </Field>
        <Field label="Available to" htmlFor="item-to" hint="Optional">
          <Input id="item-to" name="availableTo" type="time" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isVeg" defaultChecked value="true" />
          Vegetarian
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isAvailable"
            defaultChecked
            value="true"
          />
          In stock
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSpecialOfDay" value="true" />
          Special of the day
        </label>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
