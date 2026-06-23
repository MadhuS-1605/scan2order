"use client";

import { useEffect } from "react";

// Route-level error boundary. Catches render/data errors anywhere under the app
// (diner flow, admin) and shows a friendly retry instead of a blank screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort report to the server log stream.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof location !== "undefined" ? location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-grain px-6 text-center">
      <p className="font-display text-2xl text-ink">Something went wrong</p>
      <p className="mt-2 max-w-sm text-sm text-ink/55">
        We hit a snag loading this page. Please try again — if it keeps
        happening, refresh or scan the QR once more.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-ink/35">Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Try again
        </button>
        {/* Intentional full-page navigation: a hard load fully discards the
            errored React tree rather than soft-navigating within it. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/menu"
          className="rounded-lg border border-sand-300 px-5 py-2.5 text-sm font-medium text-ink/70 transition-colors hover:bg-sand-100"
        >
          Back to menu
        </a>
      </div>
    </div>
  );
}
