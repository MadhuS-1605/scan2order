import Link from "next/link";

export const metadata = { title: "Privacy Policy · Scan to Order" };

// Baseline privacy policy template — review and adapt to your jurisdiction
// (India DPDP / GDPR etc.) and replace the contact details.
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="font-display text-3xl text-ink">Privacy Policy</h1>
      <p className="mt-1 text-sm text-ink/45">How we handle your information.</p>

      <div className="prose-sm mt-8 space-y-6 text-sm leading-relaxed text-ink/75">
        <section>
          <h2 className="font-display text-lg text-ink">What we collect</h2>
          <p>
            When you order, we may collect your <strong>name</strong>,{" "}
            <strong>mobile number</strong>, order items, and—if you choose
            delivery—your <strong>delivery address</strong>. Payments are
            processed by our payment provider (Razorpay); we do not store your
            card details. We use device location only to confirm you are at the
            venue and never store exact coordinates.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">How we use it</h2>
          <p>
            To take and prepare your order, generate your bill, send order/bill
            updates over WhatsApp or email (only when you ask), and—if you opt
            in—loyalty points and dining history.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Sharing</h2>
          <p>
            We share data only with the restaurant you ordered from and the
            service providers needed to run the service (payments, messaging,
            hosting). We do not sell your data.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Your rights</h2>
          <p>
            You can view your dining history, correct your name, and{" "}
            <strong>delete your data</strong> at any time from your{" "}
            <Link href="/account" className="font-medium text-brand-600">
              account page
            </Link>{" "}
            (&ldquo;Delete my data&rdquo;). Deletion removes your profile and
            strips your name and number from past orders.
          </p>
        </section>
        <section>
          <h2 className="font-display text-lg text-ink">Contact</h2>
          <p>
            Questions about your data? Contact the restaurant directly, or the
            platform operator at the address shown on your bill.
          </p>
        </section>
      </div>

      <div className="mt-10 text-sm">
        <Link href="/terms" className="text-brand-600 hover:text-brand-700">
          Terms of Service →
        </Link>
      </div>
    </div>
  );
}
