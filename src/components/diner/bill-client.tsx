"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  MessageCircle,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  ArrowLeft,
  Users,
  Tag,
  X,
  BedDouble,
  UtensilsCrossed,
  QrCode,
} from "lucide-react";
import {
  createPaymentIntentAction,
  verifyPaymentAction,
  mockMarkPaidAction,
  requestBillOtpAction,
  verifyBillOtpAction,
  markBillDownloadedAction,
  setTipAction,
  applyCouponAction,
  removeCouponAction,
  chargeToRoomAction,
} from "@/lib/billing/actions";
import { Button, Input, Alert } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import { round2 } from "@/lib/pricing";

type RazorpayCtor = new (options: Record<string, unknown>) => {
  open: () => void;
};
declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function loadRazorpay(): Promise<RazorpayCtor | null> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay ?? null);
    s.onerror = () => resolve(null);
    document.body.appendChild(s);
  });
}

const r2 = round2;

export function BillClient({
  orderId,
  qrToken,
  restaurantId,
  paid,
  total,
  tip,
  discount,
  couponCode,
  payable,
  amountPaid,
  remaining,
  currency,
  restaurantName,
  onlineEnabled,
  counterEnabled,
  isRoom,
  roomCharged,
  roomLabel,
  upiQr,
  upiLink,
  pdfUrl,
}: {
  orderId: string;
  qrToken: string;
  restaurantId: string;
  paid: boolean;
  total: number;
  tip: number;
  discount: number;
  couponCode: string | null;
  payable: number;
  amountPaid: number;
  remaining: number;
  currency: string;
  restaurantName: string;
  onlineEnabled: boolean;
  counterEnabled: boolean;
  isRoom: boolean;
  roomCharged: boolean;
  roomLabel: string;
  upiQr: string | null;
  upiLink: string | null;
  pdfUrl: string;
}) {
  const router = useRouter();
  // Once the bill is settled, end the dining session so the next visit at this
  // table starts fresh (asks name/phone, empty cart).
  useEffect(() => {
    if (paid) {
      try {
        localStorage.removeItem(`sto_dine_${restaurantId}`);
        localStorage.removeItem(`sto_cart_${restaurantId}`);
      } catch {
        /* ignore */
      }
    }
  }, [paid, restaurantId]);
  const [busy, setBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [people, setPeople] = useState(1);
  const [customTip, setCustomTip] = useState("");
  const [coupon, setCoupon] = useState("");
  const [couponErr, setCouponErr] = useState<string | null>(null);

  async function applyCoupon() {
    setCouponErr(null);
    setBusy(true);
    try {
      const res = await applyCouponAction({ orderId, qrToken, code: coupon });
      if (res.ok) {
        setCoupon("");
        router.refresh();
      } else setCouponErr(res.error ?? "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCoupon() {
    setBusy(true);
    try {
      await removeCouponAction({ orderId, qrToken });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const [phase, setPhase] = useState<"idle" | "otp" | "sent">("idle");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [waMsg, setWaMsg] = useState<string | null>(null);
  const [waErr, setWaErr] = useState<string | null>(null);
  const [mockedOtp, setMockedOtp] = useState(false);

  const tipLocked = amountPaid > 0;
  const perPerson = r2(remaining / Math.max(1, people));

  async function applyTip(amount: number) {
    setBusy(true);
    try {
      const res = await setTipAction({ orderId, qrToken, tipAmount: amount });
      if (res.ok) router.refresh();
      else setPayError(res.error ?? "Could not set tip.");
    } finally {
      setBusy(false);
    }
  }

  async function chargeRoom() {
    setPayError(null);
    setBusy(true);
    try {
      const res = await chargeToRoomAction({ orderId, qrToken });
      if (res.ok) router.refresh();
      else setPayError(res.error ?? "Could not charge to room.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePay(amount: number) {
    setPayError(null);
    setBusy(true);
    try {
      const intent = await createPaymentIntentAction({
        orderId,
        qrToken,
        amount,
      });
      if (!intent.ok) {
        setPayError(intent.error);
        return;
      }
      if (intent.mock) {
        const res = await mockMarkPaidAction({
          orderId,
          qrToken,
          amount: intent.amount,
        });
        if (res.ok) router.refresh();
        else setPayError(res.error ?? "Payment failed.");
        return;
      }
      const Razorpay = await loadRazorpay();
      if (!Razorpay) {
        setPayError("Could not load the payment gateway.");
        return;
      }
      const rzp = new Razorpay({
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: intent.name,
        order_id: intent.razorpayOrderId,
        handler: async (resp: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const v = await verifyPaymentAction({
            orderId,
            qrToken,
            razorpayOrderId: resp.razorpay_order_id,
            razorpayPaymentId: resp.razorpay_payment_id,
            signature: resp.razorpay_signature,
          });
          if (v.ok) router.refresh();
          else setPayError(v.error ?? "Verification failed.");
        },
      });
      rzp.open();
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    window.open(pdfUrl, "_blank");
    await markBillDownloadedAction({ orderId, qrToken });
  }

  async function sendOtp() {
    setWaErr(null);
    setWaMsg(null);
    setBusy(true);
    try {
      const res = await requestBillOtpAction({ orderId, qrToken, phone });
      if (!res.ok) {
        setWaErr(res.error ?? "Could not send code.");
        return;
      }
      setMockedOtp(Boolean(res.mocked));
      setPhase("otp");
    } finally {
      setBusy(false);
    }
  }

  async function confirmOtp() {
    setWaErr(null);
    setBusy(true);
    try {
      const res = await verifyBillOtpAction({ orderId, qrToken, phone, code });
      if (!res.ok) {
        setWaErr(res.error ?? "Verification failed.");
        return;
      }
      setPhase("sent");
      setWaMsg(
        res.mocked
          ? "Bill sent! (WhatsApp is in test mode — check the server console.)"
          : "Bill sent to your WhatsApp!",
      );
    } finally {
      setBusy(false);
    }
  }

  const tipPresets = [0, 0.05, 0.1, 0.15];

  return (
    <div className="space-y-4">
      {paid ? (
        <div className="flex items-center gap-3 rounded-2xl border border-olive-500/30 bg-olive-500/10 p-4 text-olive-600">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Payment received</p>
            <p className="text-sm text-olive-600/80">
              {formatMoney(payable, currency)} paid — thank you!
            </p>
          </div>
        </div>
      ) : roomCharged ? (
        <div className="flex items-center gap-3 rounded-2xl border border-brand-500/30 bg-brand-50 p-4 text-brand-700">
          <BedDouble className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-medium">Charged to Room {roomLabel}</p>
            <p className="text-sm text-brand-700/80">
              {formatMoney(payable, currency)} added to your room folio — settle
              it at the front desk on checkout.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Coupon */}
          {!tipLocked && (
            <div className="rounded-2xl border border-sand-200 bg-surface p-5">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-ink/70">
                <Tag className="h-4 w-4" />
                Coupon
              </p>
              {couponCode ? (
                <div className="flex items-center justify-between rounded-lg border border-olive-500/30 bg-olive-500/10 px-3 py-2">
                  <span className="text-sm font-medium text-olive-600">
                    {couponCode} applied · −{formatMoney(discount, currency)}
                  </span>
                  <button
                    onClick={removeCoupon}
                    disabled={busy}
                    aria-label="Remove coupon"
                    className="text-olive-600/70 hover:text-olive-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  {couponErr && (
                    <div className="mb-2">
                      <Alert>{couponErr}</Alert>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter code"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                    <Button
                      variant="secondary"
                      onClick={applyCoupon}
                      disabled={busy || coupon.length < 3}
                    >
                      Apply
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tip */}
          {!tipLocked && (
            <div className="rounded-2xl border border-sand-200 bg-surface p-5">
              <p className="mb-3 text-sm font-medium text-ink/70">
                Add a tip{tip > 0 ? ` · ${formatMoney(tip, currency)}` : ""}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tipPresets.map((p) => {
                  const amt = r2(total * p);
                  const active = Math.abs(tip - amt) < 0.01;
                  return (
                    <button
                      key={p}
                      onClick={() => applyTip(amt)}
                      disabled={busy}
                      className={`rounded-lg border px-2 py-2 text-sm font-medium ${
                        active
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-sand-300 text-ink/70 hover:bg-sand-100"
                      }`}
                    >
                      {p === 0 ? "None" : `${p * 100}%`}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="Custom amount"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  inputMode="decimal"
                />
                <Button
                  variant="secondary"
                  onClick={() => applyTip(Number(customTip) || 0)}
                  disabled={busy || !customTip}
                >
                  Set
                </Button>
              </div>
            </div>
          )}

          {/* Pay */}
          <div className="rounded-2xl border border-sand-200 bg-surface p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink/70">
                {amountPaid > 0 ? "Remaining" : "Amount due"}
              </p>
              <p className="font-display text-2xl text-ink">
                {formatMoney(remaining, currency)}
              </p>
            </div>
            {payError && (
              <div className="mt-3">
                <Alert>{payError}</Alert>
              </div>
            )}

            {/* Split */}
            <div className="mt-4 flex items-center gap-3 rounded-lg bg-sand-100 px-3 py-2">
              <Users className="h-4 w-4 text-ink/50" />
              <span className="text-sm text-ink/70">Split between</span>
              <select
                value={people}
                onChange={(e) => setPeople(Number(e.target.value))}
                className="rounded-md border border-sand-300 bg-surface px-2 py-1 text-sm"
              >
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              {people > 1 && (
                <span className="ml-auto text-sm font-medium text-ink">
                  {formatMoney(perPerson, currency)}/person
                </span>
              )}
            </div>

            {onlineEnabled && (
              <div className="mt-3 space-y-2">
                {people > 1 && (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => handlePay(perPerson)}
                    disabled={busy}
                  >
                    <CreditCard className="h-4 w-4" />
                    {busy ? "Processing…" : `Pay my share · ${formatMoney(perPerson, currency)}`}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={people > 1 ? "secondary" : "primary"}
                  className="w-full"
                  onClick={() => handlePay(remaining)}
                  disabled={busy}
                >
                  {people <= 1 && <CreditCard className="h-4 w-4" />}
                  {busy
                    ? "Processing…"
                    : `Pay ${people > 1 ? "the full" : ""} ${formatMoney(remaining, currency)}`}
                </Button>
              </div>
            )}
            {counterEnabled && !isRoom && (
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink/50">
                <ShieldCheck className="h-3.5 w-3.5" />
                Or pay at the counter — staff will mark it paid.
              </p>
            )}

            {isRoom && (
              <div className="mt-3">
                {(onlineEnabled || counterEnabled) && (
                  <div className="mb-3 flex items-center gap-3 text-xs text-ink/40">
                    <span className="h-px flex-1 bg-sand-200" />
                    or
                    <span className="h-px flex-1 bg-sand-200" />
                  </div>
                )}
                <Button
                  size="lg"
                  variant={onlineEnabled ? "secondary" : "primary"}
                  className="w-full"
                  onClick={chargeRoom}
                  disabled={busy}
                >
                  <BedDouble className="h-4 w-4" />
                  {busy
                    ? "Charging…"
                    : `Charge ${formatMoney(remaining, currency)} to my room`}
                </Button>
                <p className="mt-2 text-center text-xs text-ink/50">
                  Settle everything at the front desk when you check out.
                </p>
              </div>
            )}
          </div>

          {/* Scan to pay — any UPI app pre-fills the amount to the venue's account */}
          {upiQr && (
            <div className="rounded-2xl border border-sand-200 bg-surface p-5 text-center">
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-ink/70">
                <QrCode className="h-4 w-4" />
                Scan to pay {formatMoney(remaining, currency)}
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upiQr}
                alt="UPI payment QR"
                className="mx-auto mt-3 h-48 w-48"
              />
              <p className="mt-2 text-xs text-ink/50">
                Google Pay, PhonePe, Paytm, BHIM — any UPI app.
              </p>
              {upiLink && (
                <a
                  href={upiLink}
                  className="mt-3 inline-block text-sm font-medium text-brand-600 hover:text-brand-700 sm:hidden"
                >
                  Tap to open a UPI app →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Delivery */}
      <div className="rounded-2xl border border-sand-200 bg-surface p-5">
        <p className="mb-3 text-sm font-medium text-ink/70">Get your bill</p>

        <Button variant="secondary" className="w-full" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          Download PDF
        </Button>

        <div className="my-4 flex items-center gap-3 text-xs text-ink/40">
          <span className="h-px flex-1 bg-sand-200" />
          or send to WhatsApp
          <span className="h-px flex-1 bg-sand-200" />
        </div>

        {waMsg && <Alert variant="success">{waMsg}</Alert>}
        {waErr && <Alert>{waErr}</Alert>}

        {phase === "idle" && (
          <div className="space-y-2">
            <Input
              placeholder="WhatsApp number e.g. +9198…"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <Button
              className="w-full"
              onClick={sendOtp}
              disabled={busy || phone.length < 8}
            >
              <MessageCircle className="h-4 w-4" />
              {busy ? "Sending…" : "Send a verification code"}
            </Button>
          </div>
        )}

        {phase === "otp" && (
          <div className="space-y-2">
            <p className="text-xs text-ink/55">
              We sent a 6-digit code to{" "}
              <span className="font-medium text-ink">{phone}</span>.
            </p>
            {mockedOtp && (
              <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
                Test mode — the code was printed to the server console.
              </p>
            )}
            <Input
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              maxLength={6}
              className="text-center text-lg tracking-[0.4em]"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setPhase("idle")}
                disabled={busy}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={confirmOtp}
                disabled={busy || code.length < 4}
              >
                {busy ? "Verifying…" : "Verify & send bill"}
              </Button>
            </div>
          </div>
        )}

        {phase === "sent" && (
          <div className="flex items-center gap-2 text-sm text-ink/60">
            <CheckCircle2 className="h-4 w-4 text-olive-600" />
            Thanks for dining at {restaurantName}!
          </div>
        )}
      </div>

      {/* Always let the diner head back to order more. */}
      <Link
        href="/menu"
        className="flex items-center justify-center gap-1.5 rounded-xl border border-brand-300 bg-surface px-6 py-3 text-center font-medium text-brand-700 transition-colors hover:bg-brand-50"
      >
        <UtensilsCrossed className="h-4 w-4" />
        Back to menu &amp; order more
      </Link>
    </div>
  );
}
