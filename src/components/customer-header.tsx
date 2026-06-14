import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

// Shared top bar for the diner-facing order/bill pages: brand + seat + a quick
// way back to the menu. Mirrors the menu header so the flow feels consistent.
export function CustomerHeader({
  restaurantName,
  groupName,
  seat,
}: {
  restaurantName: string;
  groupName?: string | null;
  seat?: string | null;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-sand-200 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div className="min-w-0">
          {groupName && groupName !== restaurantName && (
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.15em] text-brand-600">
              {groupName}
            </p>
          )}
          <p className="truncate font-display text-lg leading-tight text-ink">
            {restaurantName}
          </p>
          {seat && (
            <p className="text-xs uppercase tracking-wide text-ink/45">{seat}</p>
          )}
        </div>
        <Link
          href="/menu"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-1.5 text-sm font-medium text-ink/75 transition-colors hover:border-brand-300 hover:bg-sand-100"
        >
          <UtensilsCrossed className="h-4 w-4" />
          View menu
        </Link>
      </div>
    </header>
  );
}

// Small attribution footer shown across the diner-facing pages.
export function PoweredBy() {
  return (
    <p className="py-6 text-center text-xs text-ink/35">
      Powered by{" "}
      <span className="font-medium text-ink/45">Scan to Order</span>
    </p>
  );
}
