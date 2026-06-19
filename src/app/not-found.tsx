import Link from "next/link";

// App-wide 404. Diners hit this if a QR/table no longer resolves; keep it calm
// and point them somewhere useful.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-grain px-6 text-center">
      <p className="font-display text-5xl text-brand-600">404</p>
      <p className="mt-3 font-display text-xl text-ink">We couldn&apos;t find that</p>
      <p className="mt-2 max-w-sm text-sm text-ink/55">
        This link may have expired or the table is no longer active. Try scanning
        your table&apos;s QR code again.
      </p>
      <Link
        href="/menu"
        className="mt-6 rounded-lg border border-sand-300 px-5 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:bg-sand-100"
      >
        Go to menu
      </Link>
    </div>
  );
}
