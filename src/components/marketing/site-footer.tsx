import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Separator className="mb-8 bg-sand-200" />
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-ink/50 sm:flex-row">
          <Image src="/logo-mark.png" alt="Scan2Order" width={64} height={64} className="h-16 w-16" />
          <div className="flex items-center gap-4">
            <Link href="/features" className="hover:text-ink">
              Features
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-ink/35">
          © 2026 Scan2Order. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
