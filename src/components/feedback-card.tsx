"use client";

import { useState } from "react";
import { Star, ExternalLink, CheckCircle2 } from "lucide-react";
import { submitFeedbackAction } from "@/lib/feedback/actions";
import { Button, Textarea } from "@/components/ui";

export function FeedbackCard({
  orderId,
  qrToken,
  restaurantName,
}: {
  orderId: string;
  qrToken: string;
  restaurantName: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      const res = await submitFeedbackAction({ orderId, qrToken, rating, comment });
      if (res.ok) {
        setReviewUrl(res.reviewUrl ?? null);
        setDone(true);
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-sand-200 bg-surface p-5 text-center">
        <CheckCircle2 className="mx-auto h-7 w-7 text-olive-600" />
        <p className="mt-2 font-medium text-ink">Thanks for your feedback!</p>
        {reviewUrl && (
          <a
            href={reviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Leave us a public review
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-sand-200 bg-surface p-5">
      <p className="font-display text-lg text-ink">
        How was your meal at {restaurantName}?
      </p>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star`}
          >
            <Star
              className={`h-8 w-8 ${
                n <= (hover || rating)
                  ? "fill-brand-400 text-brand-500"
                  : "text-sand-300"
              }`}
            />
          </button>
        ))}
      </div>
      {rating > 0 && (
        <div className="mt-3 space-y-2">
          <Textarea
            placeholder="Tell us more (optional)"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button className="w-full" onClick={submit} disabled={busy}>
            {busy ? "Submitting…" : "Submit feedback"}
          </Button>
        </div>
      )}
    </div>
  );
}
