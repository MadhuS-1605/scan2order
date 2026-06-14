"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string; type: "success" | "error" };

// Fire a transient toast from anywhere on the client.
export function toast(message: string, type: "success" | "error" = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("sto:toast", { detail: { message, type } }));
}

// Mounted once in the admin layout; renders a bottom-right stack.
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let seq = 0;
    const onToast = (e: Event) => {
      const d = (e as CustomEvent).detail as { message: string; type: Toast["type"] };
      const id = ++seq + Date.now();
      setItems((cur) => [...cur, { id, message: d.message, type: d.type }]);
      setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 3200);
    };
    window.addEventListener("sto:toast", onToast);
    return () => window.removeEventListener("sto:toast", onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg ${
            t.type === "error" ? "bg-red-600" : "bg-ink"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
