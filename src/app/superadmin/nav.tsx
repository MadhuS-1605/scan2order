"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Check } from "lucide-react";

export type NavItem = { href: string; label: string };

// Console matches only the exact root; every other item also matches its
// sub-routes (e.g. /superadmin/billing/foo highlights "Revenue").
function useActive(items: NavItem[]) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/superadmin"
      ? pathname === "/superadmin"
      : pathname === href || pathname.startsWith(`${href}/`);
  return { isActive, current: items.find((n) => isActive(n.href)) };
}

function NavLinks({ items, isActive, onNavigate }: {
  items: NavItem[];
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((n) => {
        const active = isActive(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-ink/70 hover:bg-sand-100 hover:text-ink"
            }`}
          >
            {n.label}
            {active && <Check className="h-4 w-4 shrink-0" />}
          </Link>
        );
      })}
    </>
  );
}

// Persistent left sidebar — shown at md+ (see SuperAdminMobileNav for the
// hamburger drawer below that breakpoint).
export function SuperAdminSidebarNav({ items }: { items: NavItem[] }) {
  const { isActive } = useActive(items);
  return (
    <nav className="flex flex-col gap-0.5">
      <NavLinks items={items} isActive={isActive} />
    </nav>
  );
}

// Mobile-only hamburger that opens a slide-in drawer of the same nav.
// Rendered through a portal to <body>: the header uses backdrop-blur, which
// establishes a containing block for position:fixed descendants, so a drawer
// nested inside the header would clip to the header's box instead of the
// viewport.
export function SuperAdminMobileNav({ items }: { items: NavItem[] }) {
  const { isActive, current } = useActive(items);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
          <NavLinks items={items} isActive={isActive} onNavigate={() => setOpen(false)} />
        </nav>
      </div>
    </div>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/75 transition-colors hover:bg-sand-100"
      >
        <Menu className="h-4 w-4" />
        <span>{current?.label ?? "Menu"}</span>
      </button>

      {mounted && open && createPortal(drawer, document.body)}
    </div>
  );
}
