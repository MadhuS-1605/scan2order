"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLinks, type FeatureFlags } from "@/app/admin/nav";

// Mobile-only hamburger that opens a slide-in drawer of the admin nav. The
// desktop sidebar (AdminNav) is shown instead at md+.
export function MobileNav({
  role,
  features,
}: {
  role: string;
  features: FeatureFlags;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="rounded-lg border border-sand-300 p-2 text-ink/65 transition-colors hover:border-brand-300 hover:bg-sand-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col overflow-y-auto bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
              <span className="font-display text-lg text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="text-ink/55 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5 px-2 py-2">
              <NavLinks
                role={role}
                features={features}
                onNavigate={() => setOpen(false)}
              />
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
