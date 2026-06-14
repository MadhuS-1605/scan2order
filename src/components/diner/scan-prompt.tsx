import Link from "next/link";
import { QrCode } from "lucide-react";

// Shown on diner routes when there's no active table token (e.g. the cookie
// expired or the page was opened without scanning).
export function ScanPrompt() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-grain px-6 text-center">
      <QrCode className="h-12 w-12 text-ink/30" />
      <h1 className="mt-4 font-display text-2xl text-ink">Scan to start</h1>
      <p className="mt-2 max-w-xs text-sm text-ink/55">
        Scan the QR code on your table to view the menu and order.
      </p>
      <Link href="/" className="mt-5 text-sm font-medium text-brand-600">
        Go to home
      </Link>
    </div>
  );
}
