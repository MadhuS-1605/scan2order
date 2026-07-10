"use client";

import { useEffect, useState } from "react";

// Respects the user's OS-level motion preference for JS-driven animation
// (autoplay timers, pointer-tilt) — CSS transitions/keyframes are already
// neutralised globally in globals.css, but intervals and mousemove handlers
// need an explicit check.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
