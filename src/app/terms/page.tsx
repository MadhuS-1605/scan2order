import Link from "next/link";

export const metadata = { title: "Terms of Service · Scan to Order" };

// Baseline terms template — review and adapt before relying on it.
export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl text-ink">Terms of Service</h1>
      <p className="mt-1 text-sm text-ink/45">The basics of using this service.</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink/75">
        <section>
          <h2 className="font-display text-lg text-ink">Ordering</h2>
          <p>
            Orders are placed with, prepared by, and fulfilled by the
            restaurant. Prices, taxes, and availability are set by the
            restaurant and shown before you confirm.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Payments &amp; refunds</h2>
          <p>
            Payments are handled by our payment provider. Refunds, cancellations,
            and disputes are at the restaurant&apos;s discretion per its policy.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Acceptable use</h2>
          <p>
            Don&apos;t place fraudulent orders or misuse the service. The
            restaurant may refuse or cancel orders.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Liability</h2>
          <p>
            The service is provided &ldquo;as is.&rdquo; The platform facilitates
            ordering between you and the restaurant and is not responsible for the
            food or service quality.
          </p>
        </section>
      </div>

      <div className="mt-10 text-sm">
        <Link href="/privacy" className="text-brand-600 hover:text-brand-700">
          Privacy Policy →
        </Link>
      </div>
    </div>
  );
}
