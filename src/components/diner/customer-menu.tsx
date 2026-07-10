"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, X, ReceiptText, UtensilsCrossed, Search } from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { Button, Alert, VegMark } from "@/components/ui";
import { ServiceButton } from "@/components/service-button";
import { CustomerTabBar } from "@/components/diner/tab-bar";
import { Stepper } from "@/components/diner/controls";
import { localize, LANG_LABEL } from "@/lib/languages";
import {
  type Item,
  type ModGroup,
  cartSubtotal,
  lineKey,
  optionPrice,
} from "@/lib/customer/cart";
import { useCart } from "@/lib/customer/use-cart";
import { syncSessionTableAction } from "@/lib/customer/actions";

type Category = { id: string; name: string; icon?: string | null };

export function CustomerMenu({
  qrToken,
  restaurantId,
  prefill,
  happyHourPercent,
  ordering = { open: true, reason: null },
  languages,
  restaurant,
  table,
  categories,
  items,
}: {
  qrToken: string;
  restaurantId: string;
  prefill?: { itemId: string; qty: number }[];
  happyHourPercent: number;
  ordering?: { open: boolean; reason: "paused" | "closed" | "suspended" | "maintenance" | null };
  languages: string[];
  restaurant: { name: string; currency: string; groupName?: string | null; logoUrl?: string | null };
  table: { label: string; kind?: string };
  categories: Category[];
  items: Item[];
}) {
  const hhFactor = happyHourPercent > 0 ? 1 - happyHourPercent / 100 : 1;
  const orderingOpen = ordering.open;
  const [lang, setLang] = useState("en");
  const [vegOnly, setVegOnly] = useState(false);
  const [veganOnly, setVeganOnly] = useState(false);
  const [jainOnly, setJainOnly] = useState(false);
  const [gfOnly, setGfOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [customizing, setCustomizing] = useState<Item | null>(null);
  const { cart, count, addLine } = useCart(restaurantId, { prefill });

  // Auto table-move: if this device has an active dining session and has just
  // (re)scanned this table, migrate its open orders here so the bill follows.
  // Runs once per table per browser session (guarded by a sessionStorage marker).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`sto_dine_${restaurantId}`);
      if (!saved) return;
      const d = JSON.parse(saved) as { id?: string };
      if (!d?.id) return;
      const marker = `sto_synced_${qrToken}`;
      if (sessionStorage.getItem(marker)) return;
      sessionStorage.setItem(marker, "1");
      void syncSessionTableAction(d.id);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Highlight the category in the rail as the diner scrolls (scroll-spy).
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-section]"));
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = vis[0]?.target.getAttribute("data-section");
        if (id) setActiveSection(id);
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [vegOnly, lang]);
  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveSection(id);
  }

  const cur = restaurant.currency;
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const visible = items.filter(
    (i) =>
      (!vegOnly || i.isVeg) &&
      (!veganOnly || i.isVegan) &&
      (!jainOnly || i.isJain) &&
      (!gfOnly || i.isGlutenFree),
  );
  const specials = visible.filter((i) => i.isSpecialOfDay);
  const subtotal = cartSubtotal(cart, byId, hhFactor);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const searchResults = searching
    ? visible.filter((i) => {
        const { name, description } = localize(i, i.translations, lang);
        return (
          name.toLowerCase().includes(q) ||
          (description?.toLowerCase().includes(q) ?? false)
        );
      })
    : [];

  function onAdd(item: Item) {
    if (item.modifierGroups.length > 0) setCustomizing(item);
    else addLine(item.id, [], 1);
  }

  const grouped = categories
    .map((c) => ({
      category: c,
      items: visible.filter((i) => i.categoryId === c.id),
    }))
    .filter((g) => g.items.length > 0);
  const uncategorised = visible.filter((i) => !i.categoryId);

  // Entries for the left category rail (specials + each non-empty category).
  const railEntries: { id: string; label: string; icon: string }[] = [
    ...(specials.length > 0
      ? [{ id: "sec-specials", label: "Specials", icon: "⭐" }]
      : []),
    ...grouped.map((g) => ({
      id: `sec-${g.category.id}`,
      label: g.category.name,
      icon: g.category.icon || "🍽️",
    })),
  ];

  const simpleQty = (itemId: string) => cart[lineKey(itemId, [])]?.qty ?? 0;
  const totalQtyFor = (itemId: string) =>
    Object.values(cart)
      .filter((l) => l.itemId === itemId)
      .reduce((s, l) => s + l.qty, 0);

  return (
    <div className="min-h-screen bg-grain pb-36">
      <header className="sticky top-0 z-10 border-b border-sand-200 bg-surface px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            {restaurant.logoUrl && (
              <Image
                src={restaurant.logoUrl}
                alt=""
                width={40}
                height={40}
                unoptimized
                className="h-10 w-10 shrink-0 rounded-lg object-contain"
              />
            )}
            <div className="min-w-0">
              {restaurant.groupName &&
                restaurant.groupName !== restaurant.name && (
                  <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-brand-600">
                    {restaurant.groupName}
                  </p>
                )}
              <h1 className="truncate font-display text-xl leading-tight text-ink">
                {restaurant.name}
              </h1>
              <p className="text-xs uppercase tracking-wide text-ink/45">
                {table.kind === "ROOM"
                  ? `Room ${table.label}`
                  : table.kind === "COUNTER"
                    ? "Pickup"
                    : `Table ${table.label}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {languages.length > 1 && (
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-md border border-sand-300 bg-surface px-2 py-1 text-xs text-ink"
                aria-label="Language"
              >
                {languages.map((l) => (
                  <option key={l} value={l}>
                    {LANG_LABEL[l] ?? l}
                  </option>
                ))}
              </select>
            )}
            <ServiceButton qrToken={qrToken} />
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu…"
            aria-label="Search the menu"
            className="w-full rounded-lg border border-sand-300 bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink/40 focus:border-brand-400 focus:outline-none"
          />
        </div>

        {/* Filters + previous orders */}
        <div className="mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
          <FilterChip active={vegOnly} onClick={() => setVegOnly((v) => !v)}>
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-[3px] border border-olive-600">
              <span className="h-1.5 w-1.5 rounded-full bg-olive-600" />
            </span>
            Veg only
          </FilterChip>
          <FilterChip active={veganOnly} onClick={() => setVeganOnly((v) => !v)}>🌱 Vegan</FilterChip>
          <FilterChip active={jainOnly} onClick={() => setJainOnly((v) => !v)}>Jain</FilterChip>
          <FilterChip active={gfOnly} onClick={() => setGfOnly((v) => !v)}>Gluten-free</FilterChip>
          {specials.length > 0 && (
            <FilterChip active={false} onClick={() => scrollToSection("sec-specials")}>
              ⭐ Specials
            </FilterChip>
          )}
          <Link
            href="/account"
            className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-sand-100 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-sand-200"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            My orders
          </Link>
        </div>
      </header>

      {!orderingOpen && (
        <div className="mx-auto mt-3 max-w-2xl px-2 sm:px-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
            {ordering.reason === "paused"
              ? "🛎️ Ordering is paused right now — please check back in a little while. You can still browse the menu."
              : ordering.reason === "suspended"
                ? "⚠️ This venue is temporarily unavailable and isn't taking orders right now."
                : ordering.reason === "maintenance"
                  ? "🛠️ Ordering is temporarily down for maintenance — please try again shortly. You can still browse the menu."
                  : "🌙 We're closed right now, so ordering is unavailable. Browse the menu and come back during opening hours."}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-2xl gap-2 px-2 py-4 sm:gap-4 sm:px-4">
        {/* Left category rail (app-style) — hidden while searching */}
        {!searching && railEntries.length > 1 && (
          <aside className="no-scrollbar sticky top-[120px] z-[5] max-h-[calc(100dvh-140px)] w-[60px] shrink-0 overflow-y-auto sm:w-[76px]">
            <div className="flex flex-col gap-1 pb-2">
              {railEntries.map((e) => (
                <button
                  key={e.id}
                  onClick={() => scrollToSection(e.id)}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-colors ${
                    activeSection === e.id
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink/55 hover:bg-sand-100"
                  }`}
                >
                  <span className="text-xl leading-none">{e.icon}</span>
                  <span className="line-clamp-2 text-[10px] font-medium leading-tight">
                    {e.label}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Items */}
        <div className="min-w-0 flex-1 space-y-6">
          {happyHourPercent > 0 && (
            <div className="rounded-xl border border-brand-300 bg-brand-50 px-4 py-3 text-center text-sm font-medium text-brand-700">
              🍹 Happy hour — {happyHourPercent}% off everything right now!
            </div>
          )}

          {searching && (
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink/55">
                {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for
                &ldquo;{query.trim()}&rdquo;
              </h2>
              {searchResults.length === 0 ? (
                <p className="py-10 text-center text-sm text-ink/55">
                  No items match your search.
                </p>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((i) => (
                    <ItemRow
                      key={i.id}
                      item={i}
                      cur={cur}
                      hhFactor={hhFactor}
                      lang={lang}
                      orderingOpen={orderingOpen} simpleQty={simpleQty(i.id)}
                      totalQty={totalQtyFor(i.id)}
                      onAdd={() => onAdd(i)}
                      onSimpleChange={(qn) => addLine(i.id, [], qn - simpleQty(i.id))}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {!searching && specials.length > 0 && (
            <section id="sec-specials" data-section="sec-specials" className="scroll-mt-32">
              <h2 className="mb-2 flex items-center gap-1.5 font-display text-xl text-brand-600">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Today&apos;s specials
              </h2>
              <div className="space-y-2">
                {specials.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    cur={cur}
                    hhFactor={hhFactor}
                    lang={lang}
                    orderingOpen={orderingOpen} simpleQty={simpleQty(i.id)}
                    totalQty={totalQtyFor(i.id)}
                    onAdd={() => onAdd(i)}
                    onSimpleChange={(q) => addLine(i.id, [], q - simpleQty(i.id))}
                  />
                ))}
              </div>
            </section>
          )}

          {!searching &&
            grouped.map(({ category, items: catItems }) => (
            <section
              key={category.id}
              id={`sec-${category.id}`}
              data-section={`sec-${category.id}`}
              className="scroll-mt-32"
            >
              <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink/55">
                {category.icon && <span className="text-base">{category.icon}</span>}
                {category.name}
              </h2>
              <div className="space-y-2">
                {catItems.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    cur={cur}
                    hhFactor={hhFactor}
                    lang={lang}
                    orderingOpen={orderingOpen} simpleQty={simpleQty(i.id)}
                    totalQty={totalQtyFor(i.id)}
                    onAdd={() => onAdd(i)}
                    onSimpleChange={(q) => addLine(i.id, [], q - simpleQty(i.id))}
                  />
                ))}
              </div>
            </section>
          ))}

          {!searching && uncategorised.length > 0 && (
            <section>
              <div className="space-y-2">
                {uncategorised.map((i) => (
                  <ItemRow
                    key={i.id}
                    item={i}
                    cur={cur}
                    hhFactor={hhFactor}
                    lang={lang}
                    orderingOpen={orderingOpen} simpleQty={simpleQty(i.id)}
                    totalQty={totalQtyFor(i.id)}
                    onAdd={() => onAdd(i)}
                    onSimpleChange={(q) => addLine(i.id, [], q - simpleQty(i.id))}
                  />
                ))}
              </div>
            </section>
          )}

          {!searching && visible.length === 0 && (
            <p className="py-12 text-center text-sm text-ink/55">
              No items available right now.
            </p>
          )}

          <p className="py-6 text-center text-xs text-ink/35">
            Powered by{" "}
            <span className="font-medium text-ink/45">Scan to Order</span>
          </p>
        </div>
      </div>

      {/* Customizer */}
      {customizing && (
        <Customizer
          item={customizing}
          cur={cur}
          lang={lang}
          hhFactor={hhFactor}
          onClose={() => setCustomizing(null)}
          onAdd={(optionIds) => {
            addLine(customizing.id, optionIds, 1);
            setCustomizing(null);
          }}
        />
      )}

      {/* View-cart bar — links to the dedicated cart route. */}
      {count > 0 && !customizing && (
        <div className="fixed inset-x-0 bottom-[52px] z-20 border-t border-sand-200 bg-surface p-3">
          <div className="mx-auto max-w-lg">
            <Link
              href="/cart"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-center text-base font-medium text-white transition-all hover:bg-brand-700 active:translate-y-px"
            >
              View cart · {count} item{count > 1 ? "s" : ""} ·{" "}
              {formatMoney(subtotal, cur)}
            </Link>
          </div>
        </div>
      )}

      <CustomerTabBar />
    </div>
  );
}

function Customizer({
  item,
  cur,
  lang,
  hhFactor,
  onClose,
  onAdd,
}: {
  item: Item;
  cur: string;
  lang: string;
  hhFactor: number;
  onClose: () => void;
  onAdd: (optionIds: string[]) => void;
}) {
  const loc = localize(item, item.translations, lang);
  // initialise required single-select groups with their first option
  const [selected, setSelected] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of item.modifierGroups) {
      init[g.id] = g.required && g.options[0] ? [g.options[0].id] : [];
    }
    return init;
  });
  const [err, setErr] = useState<string | null>(null);

  const allIds = Object.values(selected).flat();

  function toggle(g: ModGroup, optionId: string) {
    setErr(null);
    setSelected((s) => {
      const cur = s[g.id] ?? [];
      if (g.maxSelect <= 1) return { ...s, [g.id]: [optionId] };
      if (cur.includes(optionId))
        return { ...s, [g.id]: cur.filter((x) => x !== optionId) };
      if (cur.length >= g.maxSelect) return s; // at limit
      return { ...s, [g.id]: [...cur, optionId] };
    });
  }

  function confirm() {
    for (const g of item.modifierGroups) {
      const n = (selected[g.id] ?? []).length;
      if (g.required && n < Math.max(1, g.minSelect)) {
        setErr(`Please choose ${g.name}.`);
        return;
      }
    }
    onAdd(allIds);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/40">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4">
        <div className="mx-auto max-w-lg space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-xl text-ink">{loc.name}</h2>
              {loc.description && (
                <p className="text-sm text-ink/55">{loc.description}</p>
              )}
            </div>
            <button onClick={onClose} aria-label="Close" className="text-ink/45">
              <X className="h-5 w-5" />
            </button>
          </div>

          {err && <Alert>{err}</Alert>}

          {item.modifierGroups.map((g) => (
            <div key={g.id}>
              <p className="mb-1.5 text-sm font-medium text-ink">
                {localize({ name: g.name, description: null }, g.translations, lang).name}
                <span className="ml-2 text-xs font-normal text-ink/45">
                  {g.required
                    ? "Required"
                    : g.maxSelect > 1
                      ? `Up to ${g.maxSelect}`
                      : "Optional"}
                </span>
              </p>
              <div className="space-y-1.5">
                {g.options.map((o) => {
                  const checked = (selected[g.id] ?? []).includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-sand-200 px-3 py-2 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50"
                    >
                      <span className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type={g.maxSelect <= 1 ? "radio" : "checkbox"}
                          name={g.id}
                          checked={checked}
                          onChange={() => toggle(g, o.id)}
                        />
                        {localize({ name: o.name, description: null }, o.translations, lang).name}
                      </span>
                      {g.required && g.maxSelect <= 1 ? (
                        <span className="text-sm font-medium text-ink/70">
                          {formatMoney(
                            Math.round((item.price + o.priceDelta) * hhFactor * 100) /
                              100,
                            cur,
                          )}
                        </span>
                      ) : o.priceDelta > 0 ? (
                        <span className="text-sm text-ink/60">
                          +
                          {formatMoney(
                            Math.round(o.priceDelta * hhFactor * 100) / 100,
                            cur,
                          )}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <Button size="lg" className="w-full" onClick={confirm}>
            Add to order · {formatMoney(optionPrice(item, allIds, hhFactor), cur)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  cur,
  hhFactor,
  lang,
  simpleQty,
  totalQty,
  orderingOpen = true,
  onAdd,
  onSimpleChange,
}: {
  item: Item;
  cur: string;
  hhFactor: number;
  lang: string;
  simpleQty: number;
  totalQty: number;
  orderingOpen?: boolean;
  onAdd: () => void;
  onSimpleChange: (q: number) => void;
}) {
  const hasMods = item.modifierGroups.length > 0;
  const { name, description } = localize(item, item.translations, lang);
  // Off the menu right now (outside its time window) — shown but not orderable.
  const offWindow = !item.availableNow;
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border border-sand-200 bg-surface p-3 ${
        offWindow ? "opacity-60" : ""
      }`}
    >
      {item.imageUrl ? (
        <Image
          src={item.imageUrl}
          alt={name}
          width={72}
          height={72}
          className="shrink-0 rounded-lg object-cover"
          style={{ width: 72, height: 72 }}
        />
      ) : (
        <div
          className="flex shrink-0 items-center justify-center rounded-lg bg-sand-100"
          style={{ width: 72, height: 72 }}
        >
          <UtensilsCrossed className="h-6 w-6 text-ink/20" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <VegMark isVeg={item.isVeg} />
          <p className="text-sm font-medium text-ink">{name}</p>
        </div>
        {(item.isChefSpecial ||
          item.isVegan ||
          item.isJain ||
          item.isSpicy ||
          item.isGlutenFree ||
          (item.availableFrom && item.availableTo)) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {item.isChefSpecial && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                👨‍🍳 Chef&apos;s Special
              </span>
            )}
            {item.isVegan && (
              <span className="rounded-full bg-olive-100 px-1.5 py-0.5 text-[10px] font-medium text-olive-700">🌱 Vegan</span>
            )}
            {item.isJain && (
              <span className="rounded-full bg-olive-100 px-1.5 py-0.5 text-[10px] font-medium text-olive-700">Jain</span>
            )}
            {item.isSpicy && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">🌶️ Spicy</span>
            )}
            {item.isGlutenFree && (
              <span className="rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-ink/60">GF</span>
            )}
            {item.availableFrom && item.availableTo && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-ink/55">
                🕐 {fmt12(item.availableFrom)}–{fmt12(item.availableTo)}
              </span>
            )}
          </div>
        )}
        {description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-ink/55">
            {description}
          </p>
        )}
        <p className="mt-1 text-sm">
          {hhFactor < 1 ? (
            <>
              <span className="font-semibold text-brand-600">
                {formatMoney(
                  Math.round(item.price * hhFactor * 100) / 100,
                  cur,
                )}
              </span>
              <span className="ml-1.5 text-ink/40 line-through">
                {formatMoney(item.price, cur)}
              </span>
            </>
          ) : (
            <span className="font-semibold text-ink/80">
              {formatMoney(item.price, cur)}
            </span>
          )}
          {hasMods && <span className="text-ink/40"> +</span>}
        </p>
      </div>
      <div className="shrink-0 text-center">
        {offWindow ? (
          <span className="block rounded-lg bg-sand-100 px-2.5 py-1.5 text-[11px] font-medium text-ink/50">
            {item.availableFrom && item.availableTo
              ? `${fmt12(item.availableFrom)}–${fmt12(item.availableTo)}`
              : "Unavailable"}
          </span>
        ) : !orderingOpen ? (
          <span className="block rounded-lg bg-sand-100 px-2.5 py-1.5 text-[11px] font-medium text-ink/50">
            Closed
          </span>
        ) : hasMods ? (
          <Button size="sm" variant="secondary" onClick={onAdd}>
            Add{totalQty > 0 ? ` · ${totalQty}` : ""}
          </Button>
        ) : simpleQty === 0 ? (
          <Button size="sm" variant="secondary" onClick={() => onSimpleChange(1)}>
            Add
          </Button>
        ) : (
          <Stepper qty={simpleQty} onChange={onSimpleChange} />
        )}
      </div>
    </div>
  );
}

// "07:00" -> "7 AM" (12-hour label for meal-period badges).
function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${ampm}` : `${h12} ${ampm}`;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-sand-300 bg-surface text-ink/70 hover:bg-sand-100"
      }`}
    >
      {children}
    </button>
  );
}
