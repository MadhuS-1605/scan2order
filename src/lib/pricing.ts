// Money & GST math. All amounts are plain numbers (rupees) rounded to 2dp.

export type GstMode = "NONE" | "INCLUSIVE" | "EXCLUSIVE";

export type CartLine = { price: number; quantity: number };

export type Totals = {
  subtotal: number; // pre-tax base
  taxAmount: number; // GST amount
  total: number; // amount payable
  gstMode: GstMode;
  gstPercentage: number;
};

// Round to 2 decimal places (money). Single source of truth — import this
// instead of redefining a local `r2`/`round2`.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  lines: CartLine[],
  gstMode: GstMode,
  gstPercentage: number,
): Totals {
  const gross = round2(
    lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
  );

  if (gstMode === "NONE" || gstPercentage <= 0) {
    return {
      subtotal: gross,
      taxAmount: 0,
      total: gross,
      gstMode,
      gstPercentage,
    };
  }

  const rate = gstPercentage / 100;

  if (gstMode === "EXCLUSIVE") {
    // Prices are net; GST added on top.
    const taxAmount = round2(gross * rate);
    return {
      subtotal: gross,
      taxAmount,
      total: round2(gross + taxAmount),
      gstMode,
      gstPercentage,
    };
  }

  // INCLUSIVE — prices already contain GST; back it out for the breakdown.
  const base = round2(gross / (1 + rate));
  return {
    subtotal: base,
    taxAmount: round2(gross - base),
    total: gross,
    gstMode,
    gstPercentage,
  };
}
