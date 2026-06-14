"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Lightweight polling refresh. Replaced by SSE subscription where a
// restaurantId is available (see LiveStream).
export function LiveRefresh({ intervalMs = 1000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
