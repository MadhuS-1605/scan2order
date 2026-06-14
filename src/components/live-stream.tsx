"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Subscribes to the restaurant's SSE stream and refreshes the route when an
// order changes. Falls back to periodic polling if the stream drops.
export function LiveStream({ fallbackMs = 8000 }: { fallbackMs?: number }) {
  const router = useRouter();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const refresh = () => {
      lastRefresh.current = Date.now();
      router.refresh();
    };

    const es = new EventSource("/api/realtime");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type && data.type !== "ping") refresh();
      } catch {
        // ignore malformed frames
      }
    };

    // Safety-net poll in case SSE is unavailable behind a proxy.
    const poll = setInterval(() => {
      if (Date.now() - lastRefresh.current > fallbackMs) refresh();
    }, fallbackMs);

    return () => {
      es.close();
      clearInterval(poll);
    };
  }, [router, fallbackMs]);

  return null;
}
