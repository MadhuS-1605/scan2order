import Link from "next/link";
import Image from "next/image";
import {
  ChevronDown,
  ArrowRight,
  Check,
} from "lucide-react";
import { PlanDetailsDisclosure } from "@/components/plan-details";
import { resolvePlans } from "@/lib/plan-settings";
import { env } from "@/lib/env";
import { cn, formatMoney } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Reveal } from "@/components/marketing/reveal";
import { RotatingWord } from "@/components/marketing/rotating-word";
import { InteractivePhoneDemo } from "@/components/marketing/interactive-phone-demo";
import { VenueSwitcher } from "@/components/marketing/venue-switcher";
import { TiltCard } from "@/components/marketing/tilt-card";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";

const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan2order.co.in";
// In production the marketing site lives on the apex domain and the actual
// app (signup/signin/dashboard) lives on app.<domain> — see NON_TENANT in
// src/proxy.ts. Staging is a single unified host (staging-app.<domain>, both
// marketing and app together — see NON_TENANT there too) and local dev is a
// bare IP/localhost, so both must stay on relative paths (same host) instead
// of bouncing out to the real production app.<domain>.
const APP_URL = env.appEnv === "production" ? `https://app.${PLATFORM_DOMAIN}` : "";

export const dynamic = "force-dynamic";

export default async function Home() {
  const plans = await resolvePlans();
  return (
    <div className="min-h-screen bg-grain">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Soft drifting color glows behind everything */}
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute -top-24 left-[8%] h-96 w-96 rounded-full bg-brand-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute right-[4%] top-40 hidden h-80 w-80 rounded-full bg-amber-200/30 blur-3xl sm:block"
          style={{ animationDelay: "4s" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-10 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <Reveal>
              <Badge
                variant="outline"
                className="gap-2 border-sand-300 bg-surface py-1.5 text-xs font-medium text-ink/60"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                QR ordering for restaurants, cafés &amp; hotels
              </Badge>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-5 font-display text-4xl font-medium leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
                Your{" "}
                <span className="relative inline-block">
                  table
                  <svg
                    aria-hidden
                    className="absolute -bottom-1.5 left-0 w-full"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 6 Q 28 2 54 5 T 98 3"
                      fill="none"
                      stroke="var(--color-brand-500)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      pathLength="1"
                      className="animate-draw-underline"
                    />
                  </svg>
                </span>
                , now{" "}
                <RotatingWord words={["self-serve.", "contactless.", "effortless."]} />
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
                Guests scan the code on the table, browse your menu, and order —
                no app, no waiting for a waiter. Tickets reach your kitchen the
                moment they tap <span className="text-ink">Place order</span>.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href={`${APP_URL}/signup`}
                  className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2 px-6 text-base")}
                >
                  Open your restaurant
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={`${APP_URL}/signin`}
                  className="text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
                >
                  Sign in to your dashboard
                </Link>
              </div>
              <Link
                href="#how-it-works"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/45 hover:text-ink/70"
              >
                See it in action
                <ChevronDown className="h-4 w-4 animate-bounce" />
              </Link>
            </Reveal>
          </div>

          <Reveal delay={200} className="relative">
            <div className="relative mx-auto w-full max-w-sm">
              {/* Offset warm frame behind the photo — plated-dish feel */}
              <div
                aria-hidden
                className="absolute -inset-2 rotate-2 rounded-[2rem] bg-brand-100/70"
              />
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl shadow-2xl lg:aspect-[3/4]">
                <div
                  className="animate-kenburns absolute inset-0"
                  style={{
                    backgroundImage:
                      "url(https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=80&auto=format&fit=crop)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-ink/5 to-transparent" />
              </div>
              {/* Small overlapping venue photo — collage feel */}
              <div
                aria-hidden
                className="absolute -bottom-8 -left-8 hidden h-28 w-40 -rotate-6 overflow-hidden rounded-2xl border-4 border-surface shadow-xl sm:block"
                style={{
                  backgroundImage:
                    "url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80&auto=format&fit=crop)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>
            {/* Live order ticket — the product, floating over the food */}
            <div
              className="animate-float-slow absolute -right-2 top-6 hidden w-52 rounded-xl border border-sand-200 bg-surface/95 p-3 shadow-xl backdrop-blur sm:block"
              style={{ animationDelay: "0.7s" }}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-ink">
                <span>Table 12 · #248</span>
                <span className="flex items-center gap-1 text-brand-600">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                  Preparing
                </span>
              </div>
              <p className="mt-1 text-[11px] text-ink/60">
                2× Paneer Tikka · 1× Butter Naan
              </p>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sand-100">
                <div className="h-full w-2/3 rounded-full bg-brand-500" />
              </div>
            </div>
            <div
              className="animate-float-slow absolute -right-3 bottom-14 hidden rounded-full border border-sand-200 bg-surface/95 px-3.5 py-2 text-xs font-medium text-ink shadow-lg backdrop-blur sm:block"
              style={{ animationDelay: "1.4s" }}
            >
              Bill sent on WhatsApp
            </div>
          </Reveal>
        </div>
        </div>
      </section>

      {/* Feature marquee — everything the product does, drifting past */}
      <div className="relative overflow-hidden border-t border-sand-200 bg-surface/50 py-3.5">
        <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              aria-hidden={copy === 1}
              className="flex items-center gap-8 text-sm font-medium text-ink/55"
            >
              {[
                "QR ordering",
                "Live kitchen board",
                "KOT printing",
                "UPI & Razorpay",
                "WhatsApp bills",
                "Room-folio billing",
                "GST invoices",
                "Split the bill",
                "Waitlist & reservations",
                "Happy hour",
                "Loyalty points",
                "English · हिंदी · ಕನ್ನಡ",
              ].map((f) => (
                <span key={f} className="flex items-center gap-8">
                  {f}
                  <span className="text-brand-400">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-paper to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-paper to-transparent" />
      </div>

      {/* How it works — a live, clickable walkthrough instead of a static grid */}
      <section id="how-it-works" className="border-y border-sand-200 bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">How a meal flows</p>
            <h2 className="mt-1 font-display text-3xl text-ink">Try it — it&apos;s live</h2>
          </Reveal>
          <Reveal delay={100} className="mt-8">
            <InteractivePhoneDemo />
          </Reveal>
        </div>
      </section>

      {/* For whom — an interactive switcher instead of three static cards */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <h2 className="font-display text-3xl text-ink">Built for every venue</h2>
          <p className="mt-2 max-w-md text-sm text-ink/55">
            One platform that adapts to how your guests dine — fine dining, a busy
            café counter, or in-room hotel service.
          </p>
        </Reveal>
        <Reveal delay={100} className="mt-8">
          <VenueSwitcher />
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-sand-200 bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Reveal>
            <h2 className="text-center font-display text-3xl text-ink">Simple pricing</h2>
            <p className="mt-2 text-center text-sm text-ink/55">
              Start free. Upgrade when you&apos;re ready.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => {
              const isContact = Boolean(p.contactOnly);
              return (
                <Reveal key={p.tier} delay={i * 80}>
                  <TiltCard>
                    <Card
                      className={cn(
                        "flex flex-col ring-0 transition-shadow duration-200 hover:shadow-lg",
                        p.highlight
                          ? "border-2 border-brand-400 shadow-lg shadow-brand-600/10"
                          : "border border-sand-200 hover:border-brand-300",
                      )}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                          {p.highlight && <Badge>Popular</Badge>}
                        </div>
                        <p className="text-sm text-ink/55">{p.tagline}</p>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col">
                        <p className="font-display text-3xl text-ink">
                          {isContact ? "Custom" : p.price === 0 ? "Free" : formatMoney(p.price)}
                          {!isContact && p.price > 0 && (
                            <span className="text-sm text-ink/45"> /mo</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-ink/40">
                          {isContact
                            ? "Tailored to your group"
                            : p.price > 0
                              ? "+ 18% GST · 14-day free trial"
                              : "Free forever · no card needed"}
                        </p>
                        <ul className="mt-4 space-y-1.5">
                          {p.features.map((f) => (
                            <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        <PlanDetailsDisclosure details={p.details} />
                      </CardContent>
                      <CardFooter className="mt-auto border-t-0 bg-transparent pt-0">
                        {isContact ? (
                          <a
                            href={`mailto:sales@${PLATFORM_DOMAIN}?subject=${encodeURIComponent("Scan2Order — Enterprise enquiry")}`}
                            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                          >
                            Contact sales
                          </a>
                        ) : (
                          <Link
                            href={`${APP_URL}/signup`}
                            className={cn(
                              buttonVariants({ variant: p.highlight ? "default" : "outline" }),
                              "w-full",
                            )}
                          >
                            Get started
                          </Link>
                        )}
                      </CardFooter>
                    </Card>
                  </TiltCard>
                </Reveal>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-ink/45">
            Prices exclude 18% GST. Online payments run through your own Razorpay
            account (Razorpay&apos;s ~2% gateway fee applies). Extra WhatsApp &amp;
            email beyond your plan are billed per message — bills sent inside a
            guest&apos;s 24-hour WhatsApp window are free.{" "}
            <span className="text-ink/55">
              &ldquo;Powered by Scan2Order&rdquo; stays on every plan.
            </span>
          </p>

          {/* Demo — by request (we don't publish credentials) */}
          <Reveal delay={120}>
            <Card className="mt-8 flex-row flex-wrap items-center justify-between gap-3 border border-dashed border-sand-300 px-6 py-5 text-center ring-0 sm:text-left">
              <div>
                <p className="font-medium text-ink">Want a look first?</p>
                <p className="text-sm text-ink/55">
                  Book a guided walkthrough — we&apos;ll show you the live product on a
                  quick call, or start your 14-day free trial right away.
                </p>
              </div>
              <a
                href={`mailto:sales@${PLATFORM_DOMAIN}?subject=${encodeURIComponent("Scan2Order — demo request")}`}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "shrink-0 gap-2 border-brand-300 text-brand-700 hover:bg-brand-50",
                )}
              >
                Request a demo
                <ArrowRight className="h-4 w-4" />
              </a>
            </Card>
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <Separator className="mb-8 bg-sand-200" />
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-ink/50 sm:flex-row">
            <Image src="/logo-mark.png" alt="Scan2Order" width={64} height={64} className="h-16 w-16" />
            <div className="flex items-center gap-4">
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

      <StickyMobileCta />
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-sand-200/70 bg-paper/80 backdrop-blur">
      <div aria-hidden className="scroll-progress" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center">
          <Image src="/logo-mark.png" alt="Scan2Order" width={40} height={40} priority className="h-10 w-10" />
        </Link>
        <nav className="flex items-center gap-5 text-sm">
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
