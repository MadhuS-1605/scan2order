"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

// A persistent conversion path once a mobile visitor has scrolled past the
// hero — desktop already keeps the header CTA in view via the sticky header.
export function StickyMobileCta() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function onScroll() {
      setShow(window.scrollY > window.innerHeight * 0.7);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-surface/95 px-4 py-3 backdrop-blur transition-transform duration-300 lg:hidden",
        show ? "translate-y-0" : "translate-y-full",
      )}
    >
      <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "w-full gap-2")}>
        Open your restaurant
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
