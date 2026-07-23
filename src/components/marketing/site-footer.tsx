import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

// Lucide dropped brand/logo icons a while back, so these are small hand-drawn
// outline glyphs (not the trademarked logo artwork) — same minimal-icon
// approach as every icon in the rest of the site.
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v7h3v-7h2.2l.8-3H14v-1.5c0-.5.3-.8.8-.8H15V8Z" />
    </svg>
  );
}

const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://instagram.com/scan2order.co.in", icon: InstagramIcon },
  { name: "Facebook", href: "https://facebook.com/Scan2Order", icon: FacebookIcon },
];

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Separator className="mb-8 bg-sand-200" />
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-ink/50 sm:flex-row">
          <Image src="/logo-mark.png" alt="Scan2Order" width={64} height={64} className="h-16 w-16" />
          <div className="flex items-center gap-4">
            <Link href="/about" className="hover:text-ink">
              About
            </Link>
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
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map(({ name, href, icon: Icon }) => (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={name}
                className="text-ink/40 hover:text-ink"
              >
                <Icon className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-ink/35">
          © 2026 Scan2Order. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
