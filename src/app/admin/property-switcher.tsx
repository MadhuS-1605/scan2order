"use client";

import { useState, useRef, useEffect } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { switchPropertyAction } from "@/lib/properties/actions";
import { useT } from "@/components/admin/i18n-provider";

type Property = { id: string; name: string };

// Header dropdown letting an owner flip the active property. Only rendered when
// the owner manages more than one.
export function PropertySwitcher({
  properties,
  currentId,
}: {
  properties: Property[];
  currentId: string;
}) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = properties.find((p) => p.id === currentId);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-sand-300 px-2.5 py-1.5 text-sm text-ink/70 transition-colors hover:bg-sand-100"
      >
        <Building2 className="h-4 w-4 text-brand-600" />
        <span className="hidden max-w-[10rem] truncate sm:inline">
          {current?.name ?? tr("properties.propertyFallback")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-ink/40" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-sand-200 bg-surface shadow-lg">
          <p className="px-3 pt-2 text-[11px] uppercase tracking-wide text-ink/40">
            {tr("properties.switchProperty")}
          </p>
          <ul className="py-1">
            {properties.map((p) => (
              <li key={p.id}>
                <form action={switchPropertyAction}>
                  <input type="hidden" name="restaurantId" value={p.id} />
                  <button
                    type="submit"
                    disabled={p.id === currentId}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                      p.id === currentId
                        ? "font-medium text-brand-700"
                        : "text-ink/70 hover:bg-sand-100"
                    }`}
                  >
                    {p.name}
                    {p.id === currentId && (
                      <span className="text-xs text-brand-500">{tr("properties.active")}</span>
                    )}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
