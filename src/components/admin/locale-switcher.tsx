"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { ADMIN_LOCALES } from "@/lib/i18n";
import { setAdminLocaleAction } from "@/lib/i18n-actions";

// Admin language picker — persists the choice in a cookie and refreshes.
export function LocaleSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <label className="hidden items-center gap-1 text-ink/55 sm:flex" title="Language">
      <Languages className="h-4 w-4" />
      <select
        value={current}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await setAdminLocaleAction(e.target.value);
            router.refresh();
          })
        }
        aria-label="Admin language"
        className="rounded-lg border border-sand-300 bg-surface px-2 py-1 text-sm text-ink/70"
      >
        {ADMIN_LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
