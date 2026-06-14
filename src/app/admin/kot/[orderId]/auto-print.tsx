"use client";

import { useEffect } from "react";

// Opens the browser print dialog once the ticket has rendered.
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, []);
  return null;
}
