"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

// Cycles the emphasis word in the hero headline. Pauses permanently on the
// first word for prefers-reduced-motion instead of just slowing down —
// the copy still reads fine as a single static claim.
export function RotatingWord({
  words,
  className,
  interval = 2400,
}: {
  words: string[];
  className?: string;
  interval?: number;
}) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (reduced || words.length < 2) return;
    const id = setInterval(() => {
      setFading(true);
      const swap = setTimeout(() => {
        setI((n) => (n + 1) % words.length);
        setFading(false);
      }, 250);
      return () => clearTimeout(swap);
    }, interval);
    return () => clearInterval(id);
  }, [reduced, words.length, interval]);

  return (
    <span
      className={cn(
        "inline-block text-brand-600 transition-all duration-300 ease-out",
        fading ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
    >
      {words[i]}
    </span>
  );
}
