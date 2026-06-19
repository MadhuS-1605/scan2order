"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  addCategoryAction,
  addMenuItemAction,
  deleteMenuItemAction,
} from "@/lib/onboarding/actions";
import {
  toggleAvailabilityAction,
  toggleSpecialAction,
  deleteCategoryAction,
  updateItemAction,
} from "@/lib/menu/actions";
import {
  addModifierGroupAction,
  deleteModifierGroupAction,
  addModifierOptionAction,
  deleteModifierOptionAction,
} from "@/lib/menu/modifiers";
import {
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Alert,
  Card,
  VegMark,
} from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { LANG_LABEL } from "@/lib/languages";
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
  isChefSpecial: boolean;
  availableFrom: string | null;
  availableTo: string | null;
  imageUrl: string | null;
  translations: Record<string, { name?: string; description?: string }>;
  modifierGroups: ModGroup[];
};
type ModOption = { id: string; name: string; priceDelta: string };
type ModGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: number;
  options: ModOption[];
};

export function MenuManager({
  currency,
  languages,
  categories,
  items,
}: {
  currency: string;
  languages: string[];
  categories: Category[];
  items: Item[];
}) {
  const grouped = categories.map((c) => ({
    category: c,
    items: items.filter((i) => i.categoryId === c.id),
  }));
  const uncategorised = items.filter((i) => !i.categoryId);

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <AddCategoryForm />
          <AddItemForm categories={categories} />
        </div>
      </Card>

      {grouped.map(({ category, items: catItems }) => (
        <Card key={category.id}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-ink">{category.name}</h3>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={category.id} />
              <button
                className="text-xs text-ink/45 hover:text-red-600"
                type="submit"
              >
                Delete category
              </button>
            </form>
          </div>
          <ItemList
            items={catItems}
            categories={categories}
            currency={currency}
            languages={languages}
          />
        </Card>
      ))}

      {uncategorised.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold text-ink">Uncategorised</h3>
          <ItemList
            items={uncategorised}
            categories={categories}
            currency={currency}
            languages={languages}
          />
        </Card>
      )}
    </div>
  );
}

function ItemList({
  items,
  categories,
  currency,
  languages,
}: {
  items: Item[];
  categories: Category[];
  currency: string;
  languages: string[];
}) {
  if (items.length === 0)
    return <p className="text-sm text-ink/45">No items.</p>;
  return (
    <ul className="divide-y divide-sand-100">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          categories={categories}
          currency={currency}
          languages={languages}
        />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  categories,
  currency,
  languages,
}: {
  item: Item;
  categories: Category[];
  currency: string;
  languages: string[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateItemAction,
    {},
  );
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (state.ok && detailsRef.current) detailsRef.current.open = false;
  }, [state]);

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-2">
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
                  Out of stock
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink/80">
            {formatMoney(item.price, currency)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <form action={toggleAvailabilityAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button size="sm" variant="secondary" type="submit">
            {item.isAvailable ? "Mark out of stock" : "Mark in stock"}
          </Button>
        </form>
        <form action={toggleSpecialAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button size="sm" variant="ghost" type="submit">
            {item.isSpecialOfDay ? "Unset special" : "Set as special"}
          </Button>
        </form>
        <details ref={detailsRef} className="group">
          <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100">
            Edit
          </summary>
          <form
            action={action}
            className="mt-3 space-y-3 rounded-lg border border-sand-200 p-3"
          >
            <input type="hidden" name="id" value={item.id} />
            {state.error && <Alert>{state.error}</Alert>}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name" htmlFor={`n-${item.id}`}>
                <Input
                  id={`n-${item.id}`}
                  name="name"
                  defaultValue={item.name}
                  required
                />
              </Field>
              <Field label="Price" htmlFor={`p-${item.id}`}>
                <Input
                  id={`p-${item.id}`}
                  name="price"
                  type="number"
                  step="0.01"
                  defaultValue={item.price}
                  required
                />
              </Field>
            </div>
            <Field label="Category" htmlFor={`c-${item.id}`}>
              <Select
                id={`c-${item.id}`}
                name="categoryId"
                defaultValue={item.categoryId ?? ""}
              >
                <option value="">Uncategorised</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor={`d-${item.id}`}>
              <Textarea
                id={`d-${item.id}`}
                name="description"
                rows={2}
                defaultValue={item.description ?? ""}
              />
            </Field>
            <Field label="Image URL" htmlFor={`img-${item.id}`} hint="Optional">
              <Input
                id={`img-${item.id}`}
                name="imageUrl"
                type="url"
                placeholder="https://…"
                defaultValue={item.imageUrl ?? ""}
              />
            </Field>

            {languages
              .filter((l) => l !== "en")
              .map((lang) => (
                <div
                  key={lang}
                  className="rounded-lg border border-sand-200 bg-sand-100/40 p-2"
                >
                  <p className="mb-1.5 text-xs font-medium text-ink/55">
                    {LANG_LABEL[lang] ?? lang} translation
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name={`tr_${lang}_name`}
                      placeholder="Name"
                      defaultValue={item.translations[lang]?.name ?? ""}
                    />
                    <Input
                      name={`tr_${lang}_desc`}
                      placeholder="Description"
                      defaultValue={item.translations[lang]?.description ?? ""}
                    />
                  </div>
                </div>
              ))}
            <div className="grid grid-cols-2 gap-2">
              <Field label="Available from" htmlFor={`af-${item.id}`}>
                <Input
                  id={`af-${item.id}`}
                  name="availableFrom"
                  type="time"
                  defaultValue={item.availableFrom ?? ""}
                />
              </Field>
              <Field label="Available to" htmlFor={`at-${item.id}`}>
                <Input
                  id={`at-${item.id}`}
                  name="availableTo"
                  type="time"
                  defaultValue={item.availableTo ?? ""}
                />
              </Field>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isVeg"
                  value="true"
                  defaultChecked={item.isVeg}
                />
                Veg
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isAvailable"
                  value="true"
                  defaultChecked={item.isAvailable}
                />
                In stock
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isSpecialOfDay"
                  value="true"
                  defaultChecked={item.isSpecialOfDay}
                />
                Special
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isChefSpecial"
                  value="true"
                  defaultChecked={item.isChefSpecial}
                />
                Chef&apos;s special
              </label>
            </div>
            <div className="flex justify-between">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
              {/* Submits the same form (carrying the hidden id) to the delete
                  action — avoids an invalid nested <form>. */}
              <Button
                type="submit"
                size="sm"
                variant="danger"
                formAction={deleteMenuItemAction}
                formNoValidate
              >
                Delete item
              </Button>
            </div>
          </form>
          <ModifierEditor item={item} currency={currency} languages={languages} />
        </details>
      </div>
    </li>
  );
}

function ModifierEditor({
  item,
  currency,
  languages,
}: {
  item: Item;
  currency: string;
  languages: string[];
}) {
  // Extra per-language name fields (only for non-English languages the venue uses).
  const trLangs = languages.filter((l) => l !== "en");
  return (
    <div className="mt-4 border-t border-sand-200 pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">
        Modifiers &amp; variants
      </p>

      <div className="space-y-3">
        {item.modifierGroups.map((g) => (
          <div
            key={g.id}
            className="rounded-lg border border-sand-200 bg-sand-100/40 p-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink">
                {g.name}
                <span className="ml-2 rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-normal text-ink/60">
                  {g.required ? "required · pick 1" : `optional · up to ${g.maxSelect}`}
                </span>
              </p>
              <form action={deleteModifierGroupAction}>
                <input type="hidden" name="id" value={g.id} />
                <button className="text-xs text-ink/40 hover:text-red-600" type="submit">
                  Remove
                </button>
              </form>
            </div>

            <ul className="mt-2 space-y-1">
              {g.options.map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between text-sm text-ink/80"
                >
                  <span>
                    {o.name}
                    <span className="ml-2 text-ink/45">
                      {Number(o.priceDelta) > 0
                        ? `+${formatMoney(o.priceDelta, currency)}`
                        : "free"}
                    </span>
                  </span>
                  <form action={deleteModifierOptionAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button
                      className="text-xs text-ink/40 hover:text-red-600"
                      type="submit"
                      aria-label="Remove option"
                    >
                      ✕
                    </button>
                  </form>
                </li>
              ))}
            </ul>

            <form
              action={addModifierOptionAction}
              className="mt-2 flex flex-wrap gap-2"
            >
              <input type="hidden" name="groupId" value={g.id} />
              <Input name="name" placeholder="Option (e.g. Extra cheese)" required />
              <Input
                name="priceDelta"
                type="number"
                step="0.01"
                placeholder="+₹"
                className="w-20"
              />
              {trLangs.map((lang) => (
                <Input
                  key={lang}
                  name={`tr_${lang}_name`}
                  placeholder={`Name (${LANG_LABEL[lang] ?? lang})`}
                  className="w-32"
                />
              ))}
              <Button type="submit" size="sm" variant="secondary">
                Add
              </Button>
            </form>
          </div>
        ))}
      </div>

      <form
        action={addModifierGroupAction}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="menuItemId" value={item.id} />
        <div className="flex-1">
          <Input name="name" placeholder="New group (e.g. Size, Add-ons)" required />
        </div>
        {trLangs.map((lang) => (
          <Input
            key={lang}
            name={`tr_${lang}_name`}
            placeholder={`Name (${LANG_LABEL[lang] ?? lang})`}
            className="w-32"
          />
        ))}
        <label className="flex items-center gap-1.5 text-xs text-ink/70">
          <input type="checkbox" name="required" />
          Required (variant)
        </label>
        <Input
          name="maxSelect"
          type="number"
          min="1"
          defaultValue="1"
          className="w-16"
          title="Max selectable (optional groups)"
        />
        <Button type="submit" size="sm">
          Add group
        </Button>
      </form>
    </div>
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
    <form ref={ref} action={action} className="space-y-2">
      <Field label="Add category" htmlFor="new-cat">
        <div className="flex flex-wrap gap-2">
          <Input
            id="new-cat"
            name="icon"
            placeholder="🍰"
            className="w-16 text-center"
            maxLength={2}
            aria-label="Category icon (emoji)"
          />
          <Input id="new-cat-name" name="name" placeholder="Desserts" required className="min-w-[8rem] flex-1" />
          <select
            name="station"
            defaultValue="KITCHEN"
            aria-label="Prep station"
            className="rounded-lg border border-sand-300 bg-surface px-2 text-sm"
          >
            <option value="KITCHEN">Kitchen</option>
            <option value="BAR">Bar</option>
          </select>
          <Button type="submit" disabled={pending}>
            Add
          </Button>
        </div>
      </Field>
      <p className="text-xs text-ink/45">
        Emoji shows in the menu rail. Set “Bar” to route a category&apos;s drinks
        to the bar counter.
      </p>
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
    <form ref={ref} action={action} className="space-y-2">
      {state.error && <Alert>{state.error}</Alert>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="New item" htmlFor="ni-name">
          <Input id="ni-name" name="name" placeholder="Gulab Jamun" required />
        </Field>
        <Field label="Price (₹)" htmlFor="ni-price">
          <Input
            id="ni-price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
          />
        </Field>
      </div>
      <Select name="categoryId" defaultValue="">
        <option value="">Uncategorised</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <Input name="imageUrl" type="url" placeholder="Image URL (optional)" />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isVeg" value="true" defaultChecked />
          Veg
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isAvailable"
            value="true"
            defaultChecked
          />
          In stock
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSpecialOfDay" value="true" />
          Special
        </label>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Adding…" : "Add item"}
      </Button>
    </form>
  );
}
