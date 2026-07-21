import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline · Scan2Order" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-grain px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <WifiOff className="h-6 w-6" />
      </div>
      <h1 className="mt-5 font-display text-2xl text-ink">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-sm text-ink/55">
        Check your connection and try again. Your menu will load as soon as
        you&apos;re back online.
      </p>
    </div>
  );
}
