// Builds a UPI deep link (upi://pay?...) that any UPI app (GPay, PhonePe,
// Paytm, BHIM) opens with the payee + amount pre-filled. Encoded into the
// "scan to pay" QR on bills. Pure module — safe on client and server.

export function upiPayLink(args: {
  vpa: string;
  name?: string | null;
  amount?: number;
  note?: string;
}): string {
  const p = new URLSearchParams();
  p.set("pa", args.vpa.trim());
  if (args.name) p.set("pn", args.name.trim());
  if (args.amount && args.amount > 0) p.set("am", args.amount.toFixed(2));
  p.set("cu", "INR");
  if (args.note) p.set("tn", args.note.slice(0, 50));
  return `upi://pay?${p.toString()}`;
}

// Loose VPA sanity check (name@bank). Not exhaustive — UPI handles vary.
export function isValidVpa(vpa: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim());
}
