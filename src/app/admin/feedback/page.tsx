import { Star } from "lucide-react";
import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui";

export default async function FeedbackPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("analytics");

  const feedback = await prisma.feedback.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { order: { select: { orderNumber: true } } },
  });

  const count = feedback.length;
  const avg = count
    ? feedback.reduce((s, f) => s + f.rating, 0) / count
    : 0;
  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    n: feedback.filter((f) => f.rating === star).length,
  }));

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">{t(d, "feedback.title")}</h1>

      <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
        <Card className="text-center">
          <p className="font-display text-5xl text-ink">{avg.toFixed(1)}</p>
          <div className="mt-1 flex justify-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${
                  n <= Math.round(avg)
                    ? "fill-brand-400 text-brand-500"
                    : "text-sand-300"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-ink/45">{count} {t(d, "feedback.ratings")}</p>
        </Card>

        <Card>
          <div className="space-y-1.5">
            {dist.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-sm">
                <span className="w-6 text-ink/55">{d.star}★</span>
                <div className="h-3 flex-1 overflow-hidden rounded bg-sand-100">
                  <div
                    className="h-full rounded bg-brand-400"
                    style={{ width: `${count ? (d.n / count) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-ink/55">{d.n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">{t(d, "feedback.recentComments")}</h2>
        {feedback.filter((f) => f.comment).length === 0 ? (
          <p className="text-sm text-ink/45">{t(d, "feedback.noWrittenFeedback")}</p>
        ) : (
          <ul className="divide-y divide-sand-100">
            {feedback
              .filter((f) => f.comment)
              .map((f) => (
                <li key={f.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${
                            n <= f.rating
                              ? "fill-brand-400 text-brand-500"
                              : "text-sand-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-ink/40">
                      {f.order ? `#${f.order.orderNumber} · ` : ""}
                      {f.createdAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-ink/75">{f.comment}</p>
                </li>
              ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
