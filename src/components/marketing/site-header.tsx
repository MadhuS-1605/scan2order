import Link from "next/link";
import Image from "next/image";
import { env } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan2order.co.in";
// See src/app/page.tsx's APP_URL comment — same reasoning, duplicated here
// since this now renders on more than one marketing route.
const APP_URL = env.appEnv === "production" ? `https://app.${PLATFORM_DOMAIN}` : "";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-sand-200/70 bg-paper/80 backdrop-blur">
      <div aria-hidden className="scroll-progress" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image src="/logo-mark.png" alt="Scan2Order" width={48} height={48} priority className="h-12 w-12" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/features" className="hidden text-ink/70 hover:text-ink sm:inline">
            Features
          </Link>
          <Link href="/#pricing" className="hidden text-ink/70 hover:text-ink sm:inline">
            Pricing
          </Link>
          <Link href="/about" className="hidden text-ink/70 hover:text-ink sm:inline">
            About
          </Link>
          <Link href={`${APP_URL}/signin`} className="text-ink/70 hover:text-ink">
            Sign in
          </Link>
          <Link href={`${APP_URL}/signup`} className={buttonVariants()}>
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
