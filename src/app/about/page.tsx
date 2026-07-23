import Link from "next/link";
import { ArrowRight, ShieldCheck, Wallet, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/reveal";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "About · Scan2Order" };

const VALUES = [
  {
    icon: Rocket,
    title: "Built for how Indian venues actually run",
    body: "GST invoicing, UPI, WhatsApp bills, multi-language menus — not features bolted onto a Western template, but the defaults from day one.",
  },
  {
    icon: Wallet,
    title: "Your money stays yours",
    body: "Online payments run through your own Razorpay account. We never sit between you and your guests' money, and we don't take a cut of it.",
  },
  {
    icon: ShieldCheck,
    title: "No lock-in",
    body: "Your own subdomain or custom domain, exportable reports, and a menu you fully control. If you ever want to leave, nothing here is designed to make that hard.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-grain">
      <SiteHeader />

      <section className="mx-auto max-w-3xl px-6 pb-10 pt-14 text-center">
        <Reveal>
          <h1 className="font-display text-4xl font-medium text-ink sm:text-5xl">
            Why Scan2Order exists
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink/70">
            A guest waiting for a menu, a waiter juggling six tables, a kitchen finding out an
            order was wrong only after it's plated — these are solvable problems. Scan2Order
            replaces the parts of dining that are just friction (flagging someone down to order,
            splitting a bill by hand, chasing a printed KOT) with a scan and a screen, so the
            people running the venue can spend their attention on the food and the guests, not
            the paperwork.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 80}>
              <Card className="h-full border border-sand-200 p-6">
                <v.icon className="h-8 w-8 text-brand-600" />
                <h2 className="mt-3 font-display text-lg text-ink">{v.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{v.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center">
        <Reveal>
          <h2 className="font-display text-2xl text-ink">Who it's for</h2>
          <p className="mt-3 text-ink/65">
            Restaurants, cafés, bars, cloud kitchens, bakeries, pizzerias, burger joints, QSRs
            and hotels — anywhere a guest orders and someone in the back needs to know about it
            fast. One dashboard, whichever kind of venue you run.
          </p>
          <Link
            href="/#pricing"
            className={cn(buttonVariants({ size: "lg" }), "mt-7 gap-2 px-6")}
          >
            See plans &amp; pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      <SiteFooter />
    </div>
  );
}
