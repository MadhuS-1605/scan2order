"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { clockInAction, clockOutAction } from "@/lib/attendance/actions";
import { formatDuration } from "@/lib/utils";

const MINUTE = 60_000;

// A "current time" external store, bucketed to the minute so getSnapshot is
// referentially stable within a minute (avoids render loops) and changes once
// per minute to keep the elapsed label fresh. Server snapshot is 0 so SSR
// renders no elapsed time and hydration stays consistent.
function subscribeMinute(onChange: () => void) {
  const t = setInterval(onChange, MINUTE);
  return () => clearInterval(t);
}
const minuteNow = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const minuteServer = () => 0;

// Header clock-in/out button. Captures the device location and sends it to the
// geofenced server action; shows elapsed time while clocked in.
export function ClockWidget({ openSince }: { openSince: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const now = useSyncExternalStore(subscribeMinute, minuteNow, minuteServer);

  function getCoords(): Promise<{ lat?: number; lng?: number }> {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 10_000 },
      );
    });
  }

  function punch() {
    setErr(null);
    start(async () => {
      try {
        const coords = await getCoords();
        const res = openSince
          ? await clockOutAction(coords)
          : await clockInAction(coords);
        if (res.error) {
          setErr(res.error);
          return;
        }
        router.refresh();
      } catch {
        setErr("Couldn't reach the server — check your connection and try again.");
      }
    });
  }

  const elapsed =
    openSince && now
      ? formatDuration((now - new Date(openSince).getTime()) / 60_000)
      : null;

  return (
    <div className="relative">
      <button
        onClick={punch}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
          openSince
            ? "border-olive-300 bg-olive-50 text-olive-700 hover:bg-olive-100"
            : "border-sand-300 text-ink/70 hover:border-brand-300 hover:bg-sand-100"
        }`}
      >
        <Clock className="h-4 w-4" />
        {pending
          ? "…"
          : openSince
            ? elapsed
              ? `Clock out · ${elapsed}`
              : "Clock out"
            : "Clock in"}
      </button>
      {err && (
        <p className="absolute right-0 top-full z-30 mt-1 w-60 rounded-lg border border-red-200 bg-surface px-3 py-2 text-xs text-red-700 shadow-lg">
          {err}
        </p>
      )}
    </div>
  );
}
