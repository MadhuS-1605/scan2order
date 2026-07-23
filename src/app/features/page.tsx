import Link from "next/link";
import {
  QrCode,
  ChefHat,
  Receipt,
  Boxes,
  Users,
  Building2,
  ArrowRight,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/marketing/reveal";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "Features · Scan2Order" };

const CATEGORIES: {
  icon: typeof QrCode;
  title: string;
  blurb: string;
  items: string[];
}[] = [
  {
    icon: QrCode,
    title: "Ordering & menu",
    blurb: "The core guest experience — no app, no waiting for a waiter.",
    items: [
      "QR menu & ordering, no app install",
      "Self-service kiosk mode for walk-up counters",
      "Item variants, modifiers & combos",
      "English, Hindi & Kannada menus",
      "Happy-hour pricing & loyalty points",
      "Coupons and split-the-bill",
      "Pickup & home delivery ordering",
    ],
  },
  {
    icon: ChefHat,
    title: "Kitchen & front of house",
    blurb: "Everything that keeps service moving once an order lands.",
    items: [
      "Live kitchen display board",
      "KOT thermal printing, bar & kitchen stations",
      "Visual drag-and-drop floor plan",
      "Table & zone/area management",
      "Table-side reservations with slot capacity",
      "Waitlist management",
      "Customer-facing order/bill display screen",
      "Distraction-free mobile order-taking for waiters",
    ],
  },
  {
    icon: Receipt,
    title: "Payments & billing",
    blurb: "Get paid your way, and keep the paperwork honest.",
    items: [
      "UPI & Razorpay online payments — your own account",
      "WhatsApp bills & login OTP",
      "GST-compliant invoices (inclusive or exclusive)",
      "Room-folio billing for hotels",
      "Manager-approval workflow for refunds",
      "Cash register shifts with denomination reconciliation",
      "Multiple named billing counters/registers",
    ],
  },
  {
    icon: Boxes,
    title: "Inventory & suppliers",
    blurb: "Know what you're using, wasting, and spending.",
    items: [
      "Recipe-based ingredient stock deduction",
      "Usage, wastage & cost reports",
      "Supplier directory & purchase orders",
      "Inter-outlet stock transfer",
      "Low-stock & sold-out alerts",
    ],
  },
  {
    icon: Users,
    title: "Staff & operations",
    blurb: "Run the floor without living in spreadsheets.",
    items: [
      "Role-based staff accounts (owner, manager, cashier, waiter, kitchen)",
      "Attendance clock-in/out with geofencing",
      "Delivery rider assignment & tracking",
      "Operating expense tracking",
      "Analytics, reports & CSV export",
      "Audit log of every admin action",
    ],
  },
  {
    icon: Building2,
    title: "Multi-property & platform",
    blurb: "For chains, groups, and venues that want to make it their own.",
    items: [
      "Multi-property console for restaurant groups",
      "Custom subdomain or your own domain",
      "Tenant brand-color customization",
      "Guest Wi-Fi details on the menu",
      "Integrations & webhooks (Enterprise)",
      "SSO (Enterprise)",
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-grain">
      <SiteHeader />

      <section className="mx-auto max-w-4xl px-6 pb-10 pt-14 text-center">
        <Reveal>
          <h1 className="font-display text-4xl font-medium text-ink sm:text-5xl">
            Everything your venue needs, in one dashboard
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ink/65">
            From the QR scan to the bill, and everything a kitchen, bar or hotel front desk
            needs in between.
          </p>
          <Link
            href="/#pricing"
            className={cn(buttonVariants({ size: "lg" }), "mt-7 gap-2 px-6")}
          >
            See pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Reveal>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((cat, i) => (
            <Reveal key={cat.title} delay={i * 60}>
              <Card className="h-full border border-sand-200 p-6">
                <cat.icon className="h-8 w-8 text-brand-600" />
                <h2 className="mt-3 font-display text-xl text-ink">{cat.title}</h2>
                <p className="mt-1 text-sm text-ink/55">{cat.blurb}</p>
                <ul className="mt-4 space-y-1.5">
                  {cat.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink/70">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
