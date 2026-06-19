"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Menu, X } from "lucide-react";
import { NavLinks, type FeatureFlags } from "@/app/admin/nav";

// Mobile-only hamburger that opens a slide-in drawer of the admin nav. The
// desktop sidebar (AdminNav) is shown instead at md+.
//
// The drawer is rendered through a portal to <body> on purpose: the admin
// header uses `backdrop-blur` (a backdrop-filter), which establishes a
// containing block for position:fixed descendants. Rendering the drawer inside
// the header would clip it to the header's box instead of the viewport — so it
// must escape to the body.
export function MobileNav({
  role,
  features,
}: {
  role: string;
  features: FeatureFlags;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const drawer = (
    <div className="fixed inset-0 z-50 md:hidden">
      <button
        type="button"
        aria-label="Close menu"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/40"
      />
      <div className="absolute left-0 top-0 flex h-full w-64 max-w-[80vw] flex-col overflow-y-auto bg-surface shadow-xl">
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
          <NavLinks role={role} features={features} onNavigate={() => setOpen(false)} />
        </nav>
      </div>
    </div>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="rounded-lg border border-sand-300 p-2 text-ink/65 transition-colors hover:border-brand-300 hover:bg-sand-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mounted && open && createPortal(drawer, document.body)}
    </div>
  );
}
