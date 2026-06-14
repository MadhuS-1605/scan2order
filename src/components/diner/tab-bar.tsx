"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, ReceiptText } from "lucide-react";

const TABS = [
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/account", label: "My Orders", icon: ReceiptText },
];

// App-style bottom navigation for the diner pages. Sits at the very bottom; on
// the menu the cart bar floats just above it.
export function CustomerTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active =
            t.href === "/menu" ? pathname === "/menu" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors ${
                active ? "text-brand-600" : "text-ink/45 hover:text-ink/70"
              }`}
            >
              <t.icon className="h-5 w-5" strokeWidth={1.75} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
