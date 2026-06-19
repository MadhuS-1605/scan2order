"use client";

import { useState, useTransition } from "react";
import { Printer, Loader2, Check, X } from "lucide-react";
import { printKotAction } from "@/lib/print/actions";
import { useT } from "@/components/admin/i18n-provider";

// Print a KOT: opens the browser ticket, and (if a network printer is set up)
// offers a one-tap send straight to the thermal printer.
export function PrintButton({
  orderId,
  hasPrinter,
}: {
  orderId: string;
  hasPrinter: boolean;
}) {
  const tr = useT();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  function browserPrint() {
    window.open(`/admin/kot/${orderId}`, "_blank", "noopener,width=420,height=640");
  }

  function networkPrint() {
    setState("idle");
    start(async () => {
      const r = await printKotAction(orderId);
      setState(r.ok ? "ok" : "err");
      setMsg(r.error ?? tr("kitchenPrint.sentToPrinter"));
      setTimeout(() => setState("idle"), 3000);
    });
  }

  return (
    <div className="mt-2">
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={browserPrint}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-sand-300 bg-surface py-2 text-xs font-medium text-ink/70 transition-colors hover:bg-sand-100"
      >
        <Printer className="h-3.5 w-3.5" /> {tr("kitchenPrint.printKot")}
      </button>
      {hasPrinter && (
        <button
          type="button"
          onClick={networkPrint}
          disabled={pending}
          title={tr("kitchenPrint.sendStraightTitle")}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-sand-300 bg-surface px-3 py-2 text-xs font-medium text-ink/70 transition-colors hover:bg-sand-100 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "ok" ? (
            <Check className="h-3.5 w-3.5 text-olive-600" />
          ) : state === "err" ? (
            <X className="h-3.5 w-3.5 text-red-500" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          {tr("kitchenPrint.printer")}
        </button>
      )}
    </div>
      {state === "err" && (
        <p className="mt-1 text-[11px] text-red-500" role="alert">
          {msg}
        </p>
      )}
      {state === "ok" && (
        <p className="mt-1 text-[11px] text-olive-600">{msg}</p>
      )}
    </div>
  );
}
