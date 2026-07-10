"use client";

import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";

// The server round trip (and the ticket's move into the next column) can
// take a beat — give a busy cook on a touch screen an immediate "that
// registered" signal instead of a button that just sits there.
export function StatusActionButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-colors active:translate-y-px disabled:opacity-90 ${
        pending ? "bg-olive-600" : "bg-brand-600 hover:bg-brand-700"
      }`}
    >
      {pending && <Check className="h-4 w-4 animate-pulse" />}
      {label}
    </button>
  );
}
