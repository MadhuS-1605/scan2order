"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "./toast";

// A button that runs a (void) server action with a FormData payload in a
// transition, then shows a toast and refreshes — so admin actions that used to
// be silent `<form action={…}>` submits now give feedback. Supports an optional
// confirm prompt.
export function ActionButton({
  action,
  fields = {},
  children,
  className,
  success,
  errorMessage = "Something went wrong",
  confirm,
}: {
  action: (formData: FormData) => Promise<unknown>;
  fields?: Record<string, string>;
  children: ReactNode;
  className?: string;
  success?: string;
  errorMessage?: string;
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function run() {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      try {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        await action(fd);
        if (success) toast(success);
        router.refresh();
      } catch {
        toast(errorMessage, "error");
      }
    });
  }

  return (
    <button type="button" onClick={run} disabled={pending} className={className}>
      {pending ? "…" : children}
    </button>
  );
}
