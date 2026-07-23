# Scan2Order — Complete Feature Catalog

> The exhaustive, accurate list of what the product does today. Use this as the
> master checklist when presenting so nothing is missed. Items are grouped by
> who uses them. Everything here is built and shipping.

---

## 1. Diner experience (the guest at the table)

- **QR scan-to-order** — each table has its own QR; the guest scans, the menu opens instantly on their phone. No app install.
- **Live digital menu** — categories, photos, veg/non-veg marks, chef's specials, "special of the day", prep-time estimate, happy-hour pricing.
- **Item availability** — sold-out / "86'd" items and out-of-stock (inventory) items hide automatically.
- **Modifiers & options** — add-ons and choices per item (e.g. size, extra cheese), with price deltas. Required single-select groups double as **variant/size pricing** (e.g. Small/Medium/Large).
- **Combos & meal bundles** — a combo is an orderable item that lists what it includes ("Includes: 1× Burger, 1× Fries, 1× Coke") at its own bundle price.
- **Guest Wi-Fi** — the venue's Wi-Fi name/password shown on the menu (behind a tap, when configured).
- **Cart & ordering** — add to cart, place order; order goes to the kitchen (instantly, or after a waiter confirms — configurable).
- **Order tracking** — live status (placed → preparing → ready → served) on the guest's phone.
- **Multiple service models** — dine-in (per table), self-service / counter / QSR (pay-first, pick up by number), and takeaway / delivery (cloud kitchens) with address capture. A **self-service kiosk** attract-screen (`/kiosk/<slug>`) is available for tablets pinned in kiosk mode.
- **Venue types** — Restaurant, Café, Hotel, Bar, QSR, Cloud kitchen, Bakery, Pizzeria, Burger joint, or Other — each seeds sensible module/service defaults at onboarding (see [docs/ONBOARDING.md](ONBOARDING.md)).
- **Pay how they like** — pay online (Razorpay), scan-to-pay UPI on the bill, or pay at the counter.
- **Bill delivery** — itemised GST bill as PDF, sent via WhatsApp or email, or downloaded.
- **Feedback & ratings** — 1–5 star rating + comment after the meal; happy guests are nudged to your public review page.
- **Multi-language** — English, Hindi, Kannada (menu + interface).
- **On-site ordering guard** — optional geofence so only guests physically present can order (anti-prank).

## 2. Restaurant operations (staff & managers)

- **Orders board** — every incoming order, statuses, per-item progress.
- **Kitchen Display (KDS)** — live ticket screen for the kitchen; mark items/orders ready.
- **Bar Display** — separate KDS for the bar (drinks routed to bar station).
- **Floor view** — table map / status at a glance, plus a **visual drag-and-drop floor-plan editor** (`/admin/floor/layout`) that matches the venue's real room layout.
- **Table areas/zones** — group tables into named zones (Patio, Indoor, Rooftop) for organization; purely organizational, doesn't affect ordering.
- **Customer-facing display** — a second screen (tablet/monitor facing the guest at a counter) showing the current order and running total live, so guests see pricing update as staff ring items in.
- **Captain (mobile order-taking)** — a distraction-free, no-sidebar version of staff order-taking meant for a waiter's own phone (`/captain`), reusing the same POS component and action as `/admin/orders/new`.
- **Waiter-confirm flow** — optional approval step before orders reach the kitchen.
- **KOT thermal printing** — kitchen order tickets to a network printer.
- **Table-shared billing** — everyone at a table shares one running bill; settle or clear per table.
- **Move / merge / clear tables** — handle walk-outs and seating changes.
- **Menu management** — categories & items, prices, photos (uploaded to CDN), veg flags, specials, availability windows (time-of-day), drag-free **reorder (move up/down)**, **CSV import/export**, starter-menu templates. Items can be marked as **combos** with included items listed for guests.
- **Image uploads** — upload menu photos & logo straight to cloud storage (per-venue), served via CDN.
- **Recipe-based inventory** — attach ingredients + quantities to a dish; ingredient stock auto-deducts per order (never blocks a sale — it's for cost visibility, not an oversell guard). Manual **wastage logging**, **low-stock alerts** (menu items and ingredients both), quick restock.
- **Suppliers & purchase orders** — a supplier directory and purchase orders (draft → received); receiving a PO tops up ingredient stock automatically.
- **Inventory usage/wastage/cost report** — per-ingredient used/wasted/restocked quantities and cost over a selectable window (7/30/90 days), costed at each movement's own price snapshot so later cost changes don't retroactively re-price history.
- **Inter-outlet stock transfer** — move ingredient stock between sibling outlets in a multi-property group.
- **Coupons, happy hour & loyalty** — discount codes, time-boxed happy-hour pricing, points for repeat guests.
- **Reservations & waitlist** — take bookings, confirm via WhatsApp, manage status. Optional **per-slot capacity** (max total guests per time bucket) so a busy service can't be overbooked.
- **Refunds** — full/partial refunds against paid orders (Razorpay-backed), tracked. Staff without full refund authority (Cashier/Waiter) can **request** one instead — a manager reviews and approves/declines it at `/admin/refunds` before any money moves.
- **Cash register** — staff open a shift with a counted float, close it by counting the drawer denomination-by-denomination; expected-vs-counted **variance** is flagged, with payments attributed to the exact shift that took them so concurrent registers never double-count one. Multiple **named registers/counters** support simultaneous shifts for high-volume venues.
- **Delivery riders** — assign a rider to a delivery order and track it through assigned → out for delivery → delivered; a cash-on-delivery order stays open until the rider actually collects payment.
- **Expense tracking** — log operating costs (rent, utilities, supplies, salaries, ...) by category with a period total and category breakdown.
- **Guest Wi-Fi & brand color** — show the venue's Wi-Fi details on the diner menu, and customize the diner-facing accent color to the venue's own brand (guest pages only — the admin dashboard stays Scan2Order's own look).

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
- **Display currency** — an ISO currency code the venue can pick for on-screen amounts (online payments/settlement still run through Razorpay/UPI in INR regardless — this is display-only).

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
