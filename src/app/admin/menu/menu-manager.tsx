"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  addCategoryAction,
  addMenuItemAction,
  deleteMenuItemAction,
} from "@/lib/onboarding/actions";
import {
  toggleAvailabilityAction,
  toggleSpecialAction,
  toggleCategoryActiveAction,
  deleteCategoryAction,
  updateItemAction,
  moveItemAction,
  moveCategoryAction,
  importMenuCsvAction,
  bulkUpdateItemsAction,
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
import { ImageUpload } from "@/components/admin/image-upload";
import { useT } from "@/components/admin/i18n-provider";
import { formatMoney } from "@/lib/utils";
import { LANG_LABEL } from "@/lib/languages";
import type { ActionState } from "@/lib/validation";

type Category = { id: string; name: string; isActive: boolean };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  categoryId: string | null;
  isVeg: boolean;
  isVegan: boolean;
  isJain: boolean;
  isSpicy: boolean;
  isGlutenFree: boolean;
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
  previewUrl,
}: {
  currency: string;
  languages: string[];
  categories: Category[];
  items: Item[];
  previewUrl: string | null;
}) {
  const tr = useT();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const filteredItems = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

  const grouped = categories
    .map((c) => ({
      category: c,
      items: filteredItems.filter((i) => i.categoryId === c.id),
    }))
    .filter(({ items: catItems }) => !q || catItems.length > 0);
  const uncategorised = filteredItems.filter((i) => !i.categoryId);

  function toggleSelected(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-16">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            <AddCategoryForm />
            <AddItemForm categories={categories} />
          </div>
        </div>
      </Card>

      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          {tr("menu.previewLiveMenu")} →
        </a>
      )}

      <ImportExport />

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={tr("menu.searchItems")}
        aria-label={tr("menu.searchItems")}
      />

      {grouped.map(({ category, items: catItems }, ci) => (
        <Card key={category.id} className={category.isActive ? undefined : "opacity-60"}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold text-ink">
              {category.name}
              {!category.isActive && (
                <span className="rounded bg-sand-200 px-1.5 py-0.5 text-[10px] font-normal text-ink/55">
                  {tr("menu.hiddenFromMenu")}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <form action={moveCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="dir" value="up" />
                <Button size="sm" variant="ghost" type="submit" disabled={ci === 0} aria-label={tr("menu.moveUp")}>↑</Button>
              </form>
              <form action={moveCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="dir" value="down" />
                <Button size="sm" variant="ghost" type="submit" disabled={ci === grouped.length - 1} aria-label={tr("menu.moveDown")}>↓</Button>
              </form>
              <form action={toggleCategoryActiveAction}>
                <input type="hidden" name="id" value={category.id} />
                <Button size="sm" variant="ghost" type="submit">
                  {category.isActive ? tr("menu.hideCategory") : tr("menu.showCategory")}
                </Button>
              </form>
              <form action={deleteCategoryAction}>
                <input type="hidden" name="id" value={category.id} />
                <button
                  className="text-xs text-ink/45 hover:text-red-600"
                  type="submit"
                >
                  {tr("menu.deleteCategory")}
                </button>
              </form>
            </div>
          </div>
          <ItemList
            items={catItems}
            categories={categories}
            currency={currency}
            languages={languages}
            selected={selected}
            onToggleSelected={toggleSelected}
          />
        </Card>
      ))}

      {uncategorised.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold text-ink">{tr("menu.uncategorised")}</h3>
          <ItemList
            items={uncategorised}
            categories={categories}
            currency={currency}
            languages={languages}
            selected={selected}
            onToggleSelected={toggleSelected}
          />
        </Card>
      )}

      {selected.size > 0 && (
        <BulkActionBar
          ids={[...selected]}
          onClear={() => setSelected(new Set())}
        />
      )}
    </div>
  );
}

function BulkActionBar({ ids, onClear }: { ids: string[]; onClear: () => void }) {
  const tr = useT();
  const [pct, setPct] = useState("");
  const idsValue = ids.join(",");

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-surface/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink/70">
          {ids.length} {tr("menu.selected")}
        </span>
        <form action={bulkUpdateItemsAction}>
          <input type="hidden" name="ids" value={idsValue} />
          <input type="hidden" name="op" value="enable" />
          <Button size="sm" variant="secondary" type="submit">
            {tr("menu.enable")}
          </Button>
        </form>
        <form action={bulkUpdateItemsAction}>
          <input type="hidden" name="ids" value={idsValue} />
          <input type="hidden" name="op" value="disable" />
          <Button size="sm" variant="secondary" type="submit">
            {tr("menu.disable")}
          </Button>
        </form>
        <form action={bulkUpdateItemsAction} className="flex items-center gap-1.5">
          <input type="hidden" name="ids" value={idsValue} />
          <input type="hidden" name="op" value="priceAdjust" />
          <Input
            name="pct"
            type="number"
            step="1"
            placeholder="%"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            className="w-16"
            aria-label={tr("menu.priceAdjustPercent")}
          />
          <Button size="sm" variant="secondary" type="submit" disabled={!pct}>
            {tr("menu.adjustPrice")}
          </Button>
        </form>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto text-xs font-medium text-ink/45 hover:text-ink/70"
        >
          {tr("menu.clearSelection")}
        </button>
      </div>
    </div>
  );
}

function ImportExport() {
  const tr = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    importMenuCsvAction,
    {},
  );
  return (
    <Card>
      <details className="group">
        <summary className="cursor-pointer list-none font-medium text-ink">
          {tr("menu.importExport")}
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink/55">{tr("menu.importHint")}</p>
          {state.error && <Alert>{state.error}</Alert>}
          {state.ok && state.message && <Alert variant="success">{state.message}</Alert>}
          <form action={action} className="space-y-2">
            <Textarea
              name="csv"
              rows={5}
              placeholder={"name,price,category,description,veg\nMargherita,250,Pizza,Classic cheese,yes"}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? tr("menu.importing") : tr("menu.import")}
              </Button>
              <a
                href="/api/export/menu"
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/70 hover:bg-sand-100"
              >
                {tr("menu.exportCsv")}
              </a>
            </div>
          </form>
        </div>
      </details>
    </Card>
  );
}

function ItemList({
  items,
  categories,
  currency,
  languages,
  selected,
  onToggleSelected,
}: {
  items: Item[];
  categories: Category[];
  currency: string;
  languages: string[];
  selected: Set<string>;
  onToggleSelected: (id: string) => void;
}) {
  const tr = useT();
  if (items.length === 0)
    return <p className="text-sm text-ink/45">{tr("menu.noItems")}</p>;
  return (
    <ul className="divide-y divide-sand-100">
      {items.map((item, i) => (
        <ItemRow
          key={item.id}
          item={item}
          index={i}
          total={items.length}
          categories={categories}
          currency={currency}
          languages={languages}
          isSelected={selected.has(item.id)}
          onToggleSelected={onToggleSelected}
        />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  index,
  total,
  categories,
  currency,
  languages,
  isSelected,
  onToggleSelected,
}: {
  item: Item;
  index: number;
  total: number;
  categories: Category[];
  currency: string;
  languages: string[];
  isSelected: boolean;
  onToggleSelected: (id: string) => void;
}) {
  const tr = useT();
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
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelected(item.id)}
            aria-label={tr("menu.selectItem")}
            className="h-4 w-4 shrink-0 rounded border-sand-300"
          />
          <VegMark isVeg={item.isVeg} />
          <div>
            <p className="text-sm font-medium text-ink">
              {item.name}
              {item.isSpecialOfDay && (
                <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700">
                  {tr("menu.special")}
                </span>
              )}
              {!item.isAvailable && (
                <span className="ml-2 rounded bg-sand-100 px-1.5 py-0.5 text-xs text-ink/55">
                  {tr("menu.outOfStock")}
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
        <div className="flex items-center gap-1">
          <form action={moveItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="dir" value="up" />
            <Button size="sm" variant="ghost" type="submit" disabled={index === 0} aria-label={tr("menu.moveUp")}>↑</Button>
          </form>
          <form action={moveItemAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="dir" value="down" />
            <Button size="sm" variant="ghost" type="submit" disabled={index === total - 1} aria-label={tr("menu.moveDown")}>↓</Button>
          </form>
        </div>
        <form action={toggleAvailabilityAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button size="sm" variant="secondary" type="submit">
            {item.isAvailable ? tr("menu.markOutOfStock") : tr("menu.markInStock")}
          </Button>
        </form>
        <form action={toggleSpecialAction}>
          <input type="hidden" name="id" value={item.id} />
          <Button size="sm" variant="ghost" type="submit">
            {item.isSpecialOfDay ? tr("menu.unsetSpecial") : tr("menu.setAsSpecial")}
          </Button>
        </form>
        <details ref={detailsRef} className="group">
          <summary className="cursor-pointer list-none rounded-lg px-3 py-1.5 text-sm text-ink/70 hover:bg-sand-100">
            {tr("common.edit")}
          </summary>
          <form
            action={action}
            className="mt-3 space-y-3 rounded-lg border border-sand-200 p-3"
          >
            <input type="hidden" name="id" value={item.id} />
            {state.error && <Alert>{state.error}</Alert>}
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr("common.name")} htmlFor={`n-${item.id}`}>
                <Input
                  id={`n-${item.id}`}
                  name="name"
                  defaultValue={item.name}
                  required
                />
              </Field>
              <Field label={tr("menu.price")} htmlFor={`p-${item.id}`}>
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
            <Field label={tr("menu.category")} htmlFor={`c-${item.id}`}>
              <Select
                id={`c-${item.id}`}
                name="categoryId"
                defaultValue={item.categoryId ?? ""}
              >
                <option value="">{tr("menu.uncategorised")}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tr("menu.description")} htmlFor={`d-${item.id}`}>
              <Textarea
                id={`d-${item.id}`}
                name="description"
                rows={2}
                defaultValue={item.description ?? ""}
              />
            </Field>
            <Field label={tr("menu.imageUrl")} htmlFor={`img-${item.id}`} hint={tr("common.optional")}>
              <ImageUpload name="imageUrl" kind="menu" defaultValue={item.imageUrl ?? ""} />
            </Field>

            {languages
              .filter((l) => l !== "en")
              .map((lang) => (
                <div
                  key={lang}
                  className="rounded-lg border border-sand-200 bg-sand-100/40 p-2"
                >
                  <p className="mb-1.5 text-xs font-medium text-ink/55">
                    {`${LANG_LABEL[lang] ?? lang} ${tr("menu.translation")}`}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      name={`tr_${lang}_name`}
                      placeholder={tr("common.name")}
                      defaultValue={item.translations[lang]?.name ?? ""}
                    />
                    <Input
                      name={`tr_${lang}_desc`}
                      placeholder={tr("menu.description")}
                      defaultValue={item.translations[lang]?.description ?? ""}
                    />
                  </div>
                </div>
              ))}
            <div className="grid grid-cols-2 gap-2">
              <Field label={tr("menu.availableFrom")} htmlFor={`af-${item.id}`}>
                <Input
                  id={`af-${item.id}`}
                  name="availableFrom"
                  type="time"
                  defaultValue={item.availableFrom ?? ""}
                />
              </Field>
              <Field label={tr("menu.availableTo")} htmlFor={`at-${item.id}`}>
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
                {tr("menu.veg")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isVegan" value="true" defaultChecked={item.isVegan} />
                {tr("menu.vegan")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isJain" value="true" defaultChecked={item.isJain} />
                {tr("menu.jain")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isSpicy" value="true" defaultChecked={item.isSpicy} />
                {tr("menu.spicy")}
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="isGlutenFree" value="true" defaultChecked={item.isGlutenFree} />
                {tr("menu.glutenFree")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isAvailable"
                  value="true"
                  defaultChecked={item.isAvailable}
                />
                {tr("menu.inStock")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isSpecialOfDay"
                  value="true"
                  defaultChecked={item.isSpecialOfDay}
                />
                {tr("menu.special")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isChefSpecial"
                  value="true"
                  defaultChecked={item.isChefSpecial}
                />
                {tr("menu.chefSpecial")}
              </label>
            </div>
            <div className="flex justify-between">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? tr("common.saving") : tr("menu.saveChanges")}
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
                {tr("menu.deleteItem")}
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
  const tr = useT();
  // Extra per-language name fields (only for non-English languages the venue uses).
  const trLangs = languages.filter((l) => l !== "en");
  return (
    <div className="mt-4 border-t border-sand-200 pt-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/45">
        {tr("menu.modifiersVariants")}
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
                  {g.required ? tr("menu.requiredPickOne") : `${tr("menu.optionalUpTo")} ${g.maxSelect}`}
                </span>
              </p>
              <form action={deleteModifierGroupAction}>
                <input type="hidden" name="id" value={g.id} />
                <button className="text-xs text-ink/40 hover:text-red-600" type="submit">
                  {tr("common.remove")}
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
                        : tr("menu.free")}
                    </span>
                  </span>
                  <form action={deleteModifierOptionAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button
                      className="text-xs text-ink/40 hover:text-red-600"
                      type="submit"
                      aria-label={tr("menu.removeOption")}
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
              <Input name="name" placeholder={tr("menu.optionPlaceholder")} required />
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
                  placeholder={`${tr("common.name")} (${LANG_LABEL[lang] ?? lang})`}
                  className="w-32"
                />
              ))}
              <Button type="submit" size="sm" variant="secondary">
                {tr("common.add")}
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
          <Input name="name" placeholder={tr("menu.newGroupPlaceholder")} required />
        </div>
        {trLangs.map((lang) => (
          <Input
            key={lang}
            name={`tr_${lang}_name`}
            placeholder={`${tr("common.name")} (${LANG_LABEL[lang] ?? lang})`}
            className="w-32"
          />
        ))}
        <label className="flex items-center gap-1.5 text-xs text-ink/70">
          <input type="checkbox" name="required" />
          {tr("menu.requiredVariant")}
        </label>
        <Input
          name="maxSelect"
          type="number"
          min="1"
          defaultValue="1"
          className="w-16"
          title={tr("menu.maxSelectable")}
        />
        <Button type="submit" size="sm">
          {tr("menu.addGroup")}
        </Button>
      </form>
    </div>
  );
}

function AddCategoryForm() {
  const tr = useT();
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
      <Field label={tr("menu.addCategory")} htmlFor="new-cat">
        <div className="flex flex-wrap gap-2">
          <Input
            id="new-cat"
            name="icon"
            placeholder="🍰"
            className="w-16 text-center"
            maxLength={2}
            aria-label={tr("menu.categoryIcon")}
          />
          <Input id="new-cat-name" name="name" placeholder={tr("menu.categoryNamePlaceholder")} required className="min-w-[8rem] flex-1" />
          <select
            name="station"
            defaultValue="KITCHEN"
            aria-label={tr("menu.prepStation")}
            className="rounded-lg border border-sand-300 bg-surface px-2 text-sm"
          >
            <option value="KITCHEN">{tr("menu.kitchen")}</option>
            <option value="BAR">{tr("menu.bar")}</option>
          </select>
          <Button type="submit" disabled={pending}>
            {tr("common.add")}
          </Button>
        </div>
      </Field>
      <p className="text-xs text-ink/45">
        {tr("menu.categoryHint")}
      </p>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

function AddItemForm({ categories }: { categories: Category[] }) {
  const tr = useT();
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
        <Field label={tr("menu.newItem")} htmlFor="ni-name">
          <Input id="ni-name" name="name" placeholder="Gulab Jamun" required />
        </Field>
        <Field label={tr("menu.priceCurrency")} htmlFor="ni-price">
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
        <option value="">{tr("menu.uncategorised")}</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>
      <ImageUpload name="imageUrl" kind="menu" placeholder={tr("menu.imageUrlPlaceholder")} />
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isVeg" value="true" defaultChecked />
          {tr("menu.veg")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isVegan" value="true" />
          {tr("menu.vegan")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isJain" value="true" />
          {tr("menu.jain")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSpicy" value="true" />
          {tr("menu.spicy")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isGlutenFree" value="true" />
          {tr("menu.glutenFree")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="isAvailable"
            value="true"
            defaultChecked
          />
          {tr("menu.inStock")}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSpecialOfDay" value="true" />
          {tr("menu.special")}
        </label>
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? tr("menu.adding") : tr("menu.addItem")}
      </Button>
    </form>
  );
}
