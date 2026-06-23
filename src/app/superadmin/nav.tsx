"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X, Check } from "lucide-react";

export type NavItem = { href: string; label: string };

// Hamburger menu for the platform header — 15 destinations don't fit as tabs, so
// the button shows the current section and opens a dropdown of all of them with
// the active one highlighted. Console matches only the exact root; every other
// item also matches its sub-routes.
export function SuperAdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/superadmin"
      ? pathname === "/superadmin"
      : pathname === href || pathname.startsWith(`${href}/`);
  const current = items.find((n) => isActive(n.href));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg border border-sand-300 px-3 py-1.5 text-sm font-medium text-ink/75 transition-colors hover:bg-sand-100"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        <span>{current?.label ?? "Menu"}</span>
      </button>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <nav
            role="menu"
            className="absolute left-0 z-40 mt-2 max-h-[75vh] w-56 overflow-y-auto rounded-xl border border-sand-200 bg-surface p-1.5 shadow-lg"
          >
            {items.map((n) => {
              const active = isActive(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
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
          </nav>
        </>
      )}
    </div>
  );
}
