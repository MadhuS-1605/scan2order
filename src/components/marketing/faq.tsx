import { ChevronDown } from "lucide-react";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Is the Free plan really free?",
    a: "Yes — QR menu & ordering, a live kitchen screen, and pay-at-counter for up to 10 tables, forever, no card required. Upgrade to Starter when you want online payments and WhatsApp bills.",
  },
  {
    q: "Do guests or staff need to install an app?",
    a: "No. Guests scan the table QR and order from their phone's browser. Staff (kitchen, waiters, cashiers) use the dashboard from any browser too — including a distraction-free mobile order-taking view for waiters.",
  },
  {
    q: "How do online payments work?",
    a: "Through your own Razorpay account (card/UPI), so guest payments settle directly to you — we never touch the money. Razorpay's own gateway fee (~2%) applies; there's no separate markup from us.",
  },
  {
    q: "Can I take orders in Hindi or Kannada?",
    a: "Yes — menus support English, Hindi and Kannada out of the box, with per-item translations. Guests pick their language right on the menu.",
  },
  {
    q: "What if I run a hotel or multiple outlets?",
    a: "Pro adds hotel room-folio billing, banquets, a bar KDS and KOT printing. Enterprise adds a multi-property console for chains running several venues from one login.",
  },
  {
    q: "What happens if I go over my plan's WhatsApp/email allowance?",
    a: "You're never cut off — extra messages beyond your monthly allowance are simply billed per message on your next invoice, at a small per-unit rate shown in your plan details above.",
  },
  {
    q: "Is there a free trial on paid plans?",
    a: "Yes, 14 days on Starter and Pro — no card needed to start, and you can downgrade to Free anytime without losing your menu or data.",
  },
  {
    q: "Is my data secure?",
    a: "Payment and messaging credentials are encrypted at rest, and online payments run through Razorpay's own PCI-compliant checkout — we never see or store card details. See our Privacy Policy for the full picture.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-sand-200 rounded-2xl border border-sand-200 bg-surface">
      {FAQS.map(({ q, a }) => (
        <details key={q} className="group px-5 py-4">
          <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
            {q}
            <ChevronDown className="h-4 w-4 shrink-0 text-ink/40 transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-2.5 text-sm leading-relaxed text-ink/65">{a}</p>
        </details>
      ))}
    </div>
  );
}
