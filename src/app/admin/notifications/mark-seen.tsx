"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Stamps "now" into a cookie when the notifications page is viewed, then
// refreshes so the header bell badge recomputes to 0.
export function MarkNotificationsSeen() {
  const router = useRouter();
  useEffect(() => {
    document.cookie = `sto_notif_seen=${Date.now()}; path=/; max-age=86400; samesite=lax`;
    router.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
