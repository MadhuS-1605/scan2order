"use client";

import { useEffect, useRef, useState } from "react";

// Plays a short beep + brief banner flash when a new ticket arrives on the
// kitchen screen (a fresh order, or one that just became CONFIRMED). Listens to
// the same SSE stream the board/kitchen use. Sound is best-effort (autoplay
// policy); the visual flash always shows.
export function KitchenAlert() {
  const [flash, setFlash] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/realtime");
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data) as { type?: string; status?: string };
        const isNewTicket =
          d.type === "order.created" ||
          (d.type === "order.status" && d.status === "CONFIRMED");
        if (!isNewTicket) return;
        beep();
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
      } catch {
        // ignore malformed frames
      }
    };
    return () => es.close();
  }, []);

  function beep() {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      const ctx = ctxRef.current ?? (ctxRef.current = new Ctor());
      if (ctx.state === "suspended") void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.26);
    } catch {
      // audio unavailable — visual flash still fires
    }
  }

  if (!flash) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 animate-pulse bg-brand-600 py-2 text-center text-sm font-semibold text-white">
      🔔 New order
    </div>
  );
}
