"use client";

import { useEffect } from "react";

// Registers the service worker (enables install + offline + push).
// Service workers only run in a secure context — localhost or HTTPS.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const isSecure =
      window.isSecureContext || window.location.hostname === "localhost";
    if (!isSecure) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* registration is best-effort */
    });
  }, []);
  return null;
}
