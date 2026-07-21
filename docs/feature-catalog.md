# Scan2Order — Complete Feature Catalog

> The exhaustive, accurate list of what the product does today. Use this as the
> master checklist when presenting so nothing is missed. Items are grouped by
> who uses them. Everything here is built and shipping.

---

## 1. Diner experience (the guest at the table)

- **QR scan-to-order** — each table has its own QR; the guest scans, the menu opens instantly on their phone. No app install.
- **Live digital menu** — categories, photos, veg/non-veg marks, chef's specials, "special of the day", prep-time estimate, happy-hour pricing.
- **Item availability** — sold-out / "86'd" items and out-of-stock (inventory) items hide automatically.
- **Modifiers & options** — add-ons and choices per item (e.g. size, extra cheese), with price deltas.
- **Cart & ordering** — add to cart, place order; order goes to the kitchen (instantly, or after a waiter confirms — configurable).
- **Order tracking** — live status (placed → preparing → ready → served) on the guest's phone.
- **Multiple service models** — dine-in (per table), self-service / counter / QSR (pay-first, pick up by number), and takeaway / delivery (cloud kitchens) with address capture.
- **Pay how they like** — pay online (Razorpay), scan-to-pay UPI on the bill, or pay at the counter.
- **Bill delivery** — itemised GST bill as PDF, sent via WhatsApp or email, or downloaded.
- **Feedback & ratings** — 1–5 star rating + comment after the meal; happy guests are nudged to your public review page.
- **Multi-language** — English, Hindi, Kannada (menu + interface).
- **On-site ordering guard** — optional geofence so only guests physically present can order (anti-prank).

## 2. Restaurant operations (staff & managers)

- **Orders board** — every incoming order, statuses, per-item progress.
- **Kitchen Display (KDS)** — live ticket screen for the kitchen; mark items/orders ready.
- **Bar Display** — separate KDS for the bar (drinks routed to bar station).
- **Floor view** — table map / status at a glance.
- **Waiter-confirm flow** — optional approval step before orders reach the kitchen.
- **KOT thermal printing** — kitchen order tickets to a network printer.
- **Table-shared billing** — everyone at a table shares one running bill; settle or clear per table.
- **Move / merge / clear tables** — handle walk-outs and seating changes.
- **Menu management** — categories & items, prices, photos (uploaded to CDN), veg flags, specials, availability windows (time-of-day), drag-free **reorder (move up/down)**, **CSV import/export**, starter-menu templates.
- **Image uploads** — upload menu photos & logo straight to cloud storage (per-venue), served via CDN.
- **Inventory & stock** — per-item stock tracking, auto-hide at zero, **low-stock alerts**, quick restock.
- **Coupons, happy hour & loyalty** — discount codes, time-boxed happy-hour pricing, points for repeat guests.
- **Reservations & waitlist** — take bookings, confirm via WhatsApp, manage status.
- **Refunds** — full/partial refunds against paid orders (Razorpay-backed), tracked.

## 3. Hotels & large venues

- **Rooms** — room charges posted to a folio, settled at checkout.
- **Banquets** — banquet/event bookings, convertible to orders.
- **Multi-property** — manage several outlets/properties under one login, switch between them.
- **Per-property settings** — each outlet has its own menu, config, branding, hours.

## 4. Payments, billing & compliance (India-ready)

- **Razorpay online payments** — cards, UPI, netbanking, wallets.
- **UPI scan-to-pay** — your VPA + payee name printed as a pay QR on the bill.
- **Counter payments** — cash / card at the counter.
- **GST** — inclusive or exclusive modes, configurable %, CGST/SGST split on the tax invoice.
- **GSTIN verification** — verify the venue's GSTIN and auto-fetch the registered legal name (printed on invoices).
- **FSSAI licence** — printed on the bill (Indian food compliance).
- **Tax-invoice bill PDF** — branded with logo, footer message, GST breakdown, venue-local time.
- **Tips / gratuity & discounts** — captured and reported.

## 5. Insights & reporting (owners & managers)

- **Analytics dashboard** — revenue, orders, average order value, items sold, unique/new/returning guests, GST collected, revenue trend, peak hours, top items, staff performance — with period-over-period comparison.
- **End-of-day Z-report** — single-day rollup (gross/net, paid vs placed, GST, tips, discounts, refunds, by payment method, top items) in your venue's timezone.
- **Daily summary email** — optional end-of-day sales email to the owner.
- **Feedback dashboard** — average rating, distribution, recent comments.
- **CSV exports** — orders, customers, menu, feedback.

## 6. Team & governance

- **Staff & roles** — owners, managers, staff with granular permissions.
- **Attendance** — geofenced clock-in/out, manager corrections.
- **Audit log** — who changed what (settings, menu, refunds, plan, etc.).
- **Integrations** — POS/PMS/webhooks/SSO hooks (Enterprise).

## 7. Reliability, reach & trust

- **Business hours + timezone** — venue-local hours; ordering auto-closes outside them; manual pause switch.
- **Offline-friendly PWA** — installable, resilient on flaky venue Wi-Fi.
- **Real-time updates** — orders/notifications push live to staff screens.
- **Web push notifications** — to staff devices (new order, low stock, etc.).
- **Subdomain per venue** — `yourname.<platform>` (auto-provisioned), optional custom domain.
- **Error monitoring & recovery** — stuck-payment sweep, error boundaries.

## 8. Subscription & account (how the venue pays us)

- **Plans** — Free, Starter (₹999/mo), Pro (₹2,499/mo), Enterprise (custom). 14-day full-feature trial.
- **Self-serve checkout** — Razorpay; pay-to-extend (30 days) or auto-renew (eMandate).
- **Usage metering** — WhatsApp/email included allowances per plan; overage billed transparently with a "Settle now" / bundle-into-renewal flow.
- **GST tax invoices** — downloadable invoices for every subscription/overage payment.
- **Renewal reminders** — automatic trial-ending / lapse dunning by email, WhatsApp & push.

---

## Platform operations (for the operator team — NOT shown to venue owners)

> This is the back-office console *you* run the business with. Keep it separate
> from the owner pitch.

- **Console** — all tenants, search/filter/sort/pagination, plan distribution, top performers.
- **Revenue dashboard** — MRR/ARR, active subscriptions, trials & expiring, churn, plan revenue, overage collected, usage leaders.
- **Per-tenant drill-down** — profile, subscription, usage, team, recent payments, **internal support notes**, downloadable invoices.
- **Lifecycle controls** — grant/extend/comp a plan, suspend/reactivate a venue, **impersonate** ("log in as tenant") for support.
- **Growth & funnel** — signups over time, onboarding conversion, churn, venue-type & geo distribution.
- **Platform health** — failed payments, refunds, stuck orders, service-config status.
- **Announcements** — broadcast a banner to every tenant admin.
- **Feature flags / kill switches** — signups, WhatsApp, email, online payments, ordering maintenance.
- **Operator roles** — Full / Billing / Support sub-roles.
- **Domains & DNS** — per-tenant subdomain status + re-sync.
- **Audit log + CSV exports** — every operator action; revenue/audit exports.
- **Dunning & daily-summary crons** — automated owner emails.
