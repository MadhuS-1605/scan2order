import Link from "next/link";
import {
  QrCode,
  UtensilsCrossed,
  ChefHat,
  ReceiptText,
  ArrowRight,
} from "lucide-react";
import { VegMark } from "@/components/ui";
import { PLANS } from "@/lib/plans";
import { formatMoney } from "@/lib/utils";
import { Check } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-grain">
      <Header />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-10 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-sand-300 bg-surface px-3 py-1 text-xs font-medium text-ink/60">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              QR ordering for restaurants, cafés &amp; hotels
            </p>
            <h1 className="font-display text-4xl font-medium leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
              Your table,{" "}
              <em className="text-brand-600">now self-serve.</em>
            </h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink/70">
              Guests scan the code on the table, browse your menu, and order —
              no app, no waiting for a waiter. Tickets reach your kitchen the
              moment they tap <span className="text-ink">Place order</span>.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition-all hover:bg-brand-700 active:translate-y-px"
              >
                Open your restaurant
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/signin"
                className="text-sm font-medium text-ink/70 underline-offset-4 hover:text-ink hover:underline"
              >
                Sign in to your dashboard
              </Link>
            </div>
          </div>

          <MenuPreview />
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-sand-200 bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <p className="font-display text-sm italic text-brand-600">
            How a meal flows
          </p>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-sand-200 bg-sand-200 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-surface p-6">
                <div className="flex items-center gap-3">
                  <s.icon className="h-5 w-5 text-brand-600" strokeWidth={1.75} />
                  <span className="font-display text-lg text-ink/30">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="mt-3 font-medium text-ink">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink/60">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="border-t-2 border-ink pt-4">
              <h3 className="font-display text-xl text-ink">{a.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">
                {a.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-sand-200 bg-surface/60">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <h2 className="text-center font-display text-3xl text-ink">
            Simple pricing
          </h2>
          <p className="mt-2 text-center text-sm text-ink/55">
            Start free. Upgrade when you&apos;re ready.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLANS.map((p) => (
              <div
                key={p.tier}
                className={`flex flex-col rounded-2xl border bg-surface p-6 ${
                  p.highlight ? "border-brand-400 ring-1 ring-brand-200" : "border-sand-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl text-ink">{p.name}</h3>
                  {p.highlight && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                      Popular
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink/55">{p.tagline}</p>
                <p className="mt-3 font-display text-3xl text-ink">
                  {p.price === 0 ? "Free" : formatMoney(p.price)}
                  {p.price > 0 && <span className="text-sm text-ink/45"> /mo</span>}
                </p>
                <ul className="mt-4 flex-1 space-y-1.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-ink/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-5 rounded-lg py-2 text-center text-sm font-medium transition-colors ${
                    p.highlight
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-sand-300 text-ink hover:bg-sand-100"
                  }`}
                >
                  Get started
                </Link>
              </div>
            ))}
          </div>

          {/* Demo */}
          <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-2xl border border-dashed border-sand-300 bg-surface px-6 py-5 text-center sm:flex-row sm:text-left">
            <div>
              <p className="font-medium text-ink">Want a look first? Try the live demo.</p>
              <p className="text-sm text-ink/55">
                Sign in with{" "}
                <span className="font-medium text-ink">demo@scan.to</span> /{" "}
                <span className="font-medium text-ink">password123</span>
              </p>
            </div>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-surface px-5 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              Open the demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-sand-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-ink/50 sm:flex-row">
          <span className="font-display text-base text-ink">Scan to Order</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Header() {
  return (
    <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
      <Link href="/" className="font-display text-xl font-medium text-ink">
        Scan&nbsp;to&nbsp;Order
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/signin" className="text-ink/70 hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-ink px-4 py-2 font-medium text-paper hover:bg-ink/90"
        >
          Get started
        </Link>
      </nav>
    </header>
  );
}

function MenuPreview() {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="rotate-1 rounded-2xl border border-sand-200 bg-surface p-5 shadow-[0_1px_0_rgba(34,30,24,0.04)]">
        <div className="flex items-center justify-between border-b border-dashed border-sand-300 pb-3">
          <div>
            <p className="font-display text-lg text-ink">Spice Garden</p>
            <p className="text-xs text-ink/45">Table 4</p>
          </div>
          <QrCode className="h-8 w-8 text-ink/30" strokeWidth={1.5} />
        </div>
        <ul className="mt-3 space-y-3">
          {PREVIEW_ITEMS.map((it) => (
            <li key={it.name} className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5">
                  <VegMark isVeg={it.veg} />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink">{it.name}</p>
                  <p className="text-xs text-ink/50">{it.note}</p>
                </div>
              </div>
              <span className="whitespace-nowrap text-sm text-ink/70">
                ₹{it.price}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white">
          <span>Place order</span>
          <span>₹520</span>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    icon: QrCode,
    title: "Scan",
    body: "A guest scans the unique QR on their table.",
  },
  {
    icon: UtensilsCrossed,
    title: "Order",
    body: "They browse the live menu and place an order.",
  },
  {
    icon: ChefHat,
    title: "Cook",
    body: "The ticket appears on your kitchen screen.",
  },
  {
    icon: ReceiptText,
    title: "Pay",
    body: "They pay online or at the counter, bill on WhatsApp.",
  },
];

const AUDIENCES = [
  {
    title: "Restaurants",
    body: "Onboard in minutes — menu, tables, QR codes, GST and payment rules, all in one place.",
  },
  {
    title: "Diners",
    body: "No app to install. Scan, order, track the kitchen, and pay however suits them.",
  },
  {
    title: "The kitchen",
    body: "A clean, live ticket board with one-tap status — and a customer-facing pickup screen.",
  },
];

const PREVIEW_ITEMS = [
  { name: "Paneer Tikka", note: "Chef's special", veg: true, price: 220 },
  { name: "Butter Chicken", note: "Rich & creamy", veg: false, price: 340 },
  { name: "Garlic Naan", note: "Stone-baked", veg: true, price: 80 },
];
