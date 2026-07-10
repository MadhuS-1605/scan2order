"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const AUDIENCES = [
  {
    title: "Restaurants & bars",
    body: "Per-table QR ordering, a live floor, KOT printing and one consolidated bill.",
    img: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80&auto=format&fit=crop",
    points: ["Per-table QR ordering", "Live floor view", "KOT printing + one bill"],
  },
  {
    title: "Cafés & QSR",
    body: "One counter QR, pay-first, pick up by number — fast self-service for busy footfall.",
    img: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1200&q=80&auto=format&fit=crop",
    points: ["Single counter QR", "Pay-first ordering", "Pickup-by-number"],
  },
  {
    title: "Hotels",
    body: "In-room dining charged to the room folio, plus banquets and multi-property management.",
    img: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=80&auto=format&fit=crop",
    points: ["Room-folio billing", "Banquets & events", "Multi-property console"],
  },
];

export function VenueSwitcher() {
  const [active, setActive] = useState(0);
  const a = AUDIENCES[active];

  return (
    <div>
      <div
        className="inline-flex flex-wrap gap-1 rounded-full border border-sand-200 bg-surface p-1"
        role="tablist"
        aria-label="Venue type"
      >
        {AUDIENCES.map((item, i) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={active === i}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active === i ? "bg-brand-600 text-white" : "text-ink/60 hover:text-ink",
            )}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="mt-6 grid overflow-hidden rounded-2xl border border-sand-200 lg:grid-cols-2">
        <div
          key={a.img}
          role="img"
          aria-label={a.title}
          className="animate-panel-fade aspect-[16/10] bg-cover bg-center lg:aspect-auto"
          style={{ backgroundImage: `url(${a.img})` }}
        />
        <div key={a.title} className="animate-panel-fade flex flex-col justify-center gap-3 bg-surface p-8">
          <h3 className="font-display text-2xl text-ink">{a.title}</h3>
          <p className="text-sm leading-relaxed text-ink/60">{a.body}</p>
          <ul className="mt-2 space-y-1.5">
            {a.points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-ink/70">
                <Check className="h-4 w-4 shrink-0 text-olive-600" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
