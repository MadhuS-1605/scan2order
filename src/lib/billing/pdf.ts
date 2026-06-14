import "server-only";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

export type BillPdfData = {
  restaurant: {
    name: string;
    addressLine: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    gstNumber: string | null;
  };
  billNumber: string;
  date: Date;
  tableLabel: string | null;
  customerName: string | null;
  token: string; // order number(s) for this visit
  items: { name: string; quantity: number; price: number; lineTotal: number }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  discount: number;
  couponCode: string | null;
  tip: number;
  payable: number;
  gstMode: string;
  gstPercentage: number;
  paid: boolean;
  payUrl?: string | null; // encoded into the QR
  qrIsUpi?: boolean; // true = payUrl is a UPI pay link (scan to pay)
};

// 80mm thermal receipt: 80mm = 3.1496in = 226.77pt wide, continuous height.
const W = 226.77;
const M = 10; // side margin
const INNER = W - M * 2;

const money = (n: number): string => n.toFixed(2);

export async function generateBillPdf(data: BillPdfData): Promise<Buffer> {
  // Pre-generate the payment QR (PNG) so we can size the page for it.
  let qr: Buffer | null = null;
  if (data.payUrl) {
    try {
      qr = await QRCode.toBuffer(data.payUrl, { margin: 1, width: 220 });
    } catch {
      qr = null;
    }
  }

  // Estimate the continuous-roll height from the content.
  const itemLines = data.items.reduce(
    (s, it) => s + Math.max(1, Math.ceil(it.name.length / 26)),
    0,
  );
  const hasGst = data.gstMode !== "NONE";
  const height =
    150 + // header + meta
    16 + // table header
    itemLines * 11 +
    data.items.length * 4 +
    80 + // totals
    (hasGst ? 60 : 0) + // gst breakup
    (qr ? 110 : 0) +
    60; // footer

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [W, height],
      margins: { top: M, bottom: M, left: M, right: M },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = M;
    const center = (
      text: string,
      size: number,
      font: "Helvetica" | "Helvetica-Bold" = "Helvetica",
      gap = 2,
    ) => {
      doc.font(font).fontSize(size).fillColor("#000");
      doc.text(text, M, y, { width: INNER, align: "center" });
      y = doc.y + gap;
    };
    const rule = () => {
      doc
        .moveTo(M, y)
        .lineTo(W - M, y)
        .lineWidth(0.5)
        .dash(2, { space: 1.5 })
        .strokeColor("#000")
        .stroke()
        .undash();
      y += 5;
    };
    // A left-label / right-value row.
    const lr = (
      label: string,
      value: string,
      size = 7.5,
      font: "Helvetica" | "Helvetica-Bold" = "Helvetica",
    ) => {
      doc.font(font).fontSize(size).fillColor("#000");
      doc.text(label, M, y, { width: INNER / 2, align: "left" });
      doc.text(value, M + INNER / 2, y, { width: INNER / 2, align: "right" });
      y += size + 3;
    };

    // --- Status + header ---
    if (data.paid) center("PAID", 9, "Helvetica-Bold", 3);
    center(data.restaurant.name, 12, "Helvetica-Bold", 2);
    const addr = [
      data.restaurant.addressLine,
      [data.restaurant.city, data.restaurant.state].filter(Boolean).join(", "),
      data.restaurant.phone ? `Ph: ${data.restaurant.phone}` : null,
    ].filter(Boolean) as string[];
    for (const a of addr) center(a, 6.5, "Helvetica", 0);
    if (data.restaurant.gstNumber) center(`GST: ${data.restaurant.gstNumber}`, 6.5, "Helvetica", 2);
    y += 2;
    rule();

    center("TAX INVOICE", 9, "Helvetica-Bold", 3);

    // --- Meta ---
    lr(`Bill No: ${data.billNumber}`, `Token: ${data.token}`);
    lr(
      `Date: ${data.date.toLocaleDateString("en-IN")}`,
      data.date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    );
    if (data.tableLabel) lr(`Table: ${data.tableLabel}`, data.customerName ?? "");
    else if (data.customerName) lr(`Name: ${data.customerName}`, "");
    rule();

    // --- Item grid ---
    // Columns: name | qty | price | amount
    const qtyX = M + 108;
    const priceX = M + 132;
    const amtX = M + 168;
    const colRow = (
      name: string,
      qty: string,
      price: string,
      amt: string,
      font: "Helvetica" | "Helvetica-Bold",
    ) => {
      doc.font(font).fontSize(7).fillColor("#000");
      const yStart = y;
      doc.text(name, M, yStart, { width: 100 });
      const nameH = doc.y - yStart;
      doc.text(qty, qtyX, yStart, { width: 22, align: "right" });
      doc.text(price, priceX, yStart, { width: 34, align: "right" });
      doc.text(amt, amtX, yStart, { width: W - M - amtX, align: "right" });
      y = yStart + Math.max(nameH, 9) + 2;
    };
    colRow("Item", "Qty", "Price", "Amount", "Helvetica-Bold");
    rule();
    for (const it of data.items) {
      colRow(it.name, String(it.quantity), money(it.price), money(it.lineTotal), "Helvetica");
    }
    rule();

    // --- Totals ---
    const totalQty = data.items.reduce((s, it) => s + it.quantity, 0);
    lr(`Items / Qty: ${data.items.length} / ${totalQty}`, "");
    if (data.gstMode !== "NONE") {
      lr(data.gstMode === "INCLUSIVE" ? "Taxable value" : "Sub Total", money(data.subtotal));
      const half = data.gstPercentage / 2;
      lr(`CGST ${half}%`, money(data.taxAmount / 2));
      lr(`SGST ${half}%`, money(data.taxAmount / 2));
    } else {
      lr("Sub Total", money(data.subtotal));
    }
    if (data.discount > 0)
      lr(data.couponCode ? `Discount (${data.couponCode})` : "Discount", "- " + money(data.discount));
    if (data.tip > 0) lr("Tip", money(data.tip));
    rule();
    lr("GRAND TOTAL", "Rs. " + money(data.payable), 11, "Helvetica-Bold");
    rule();

    // --- GST break-up (matches the pattern on Indian bills) ---
    if (data.gstMode !== "NONE" && data.taxAmount > 0) {
      const half = data.gstPercentage / 2;
      doc.font("Helvetica").fontSize(6).fillColor("#000");
      center("--- GST Break-up ---", 6, "Helvetica", 1);
      lr(
        `Taxable: ${money(data.subtotal)}`,
        `CGST(${half}%): ${money(data.taxAmount / 2)}  SGST(${half}%): ${money(data.taxAmount / 2)}`,
        6,
      );
      y += 3;
    }

    // --- Footer ---
    center(data.paid ? "Thank you, visit again!" : "Please pay at the counter", 7.5, "Helvetica-Bold", 3);
    if (qr) {
      const qrSize = 100;
      if (data.qrIsUpi) center("Scan to pay", 7.5, "Helvetica-Bold", 2);
      doc.image(qr, (W - qrSize) / 2, y, { width: qrSize, height: qrSize });
      y += qrSize + 3;
      center(
        data.qrIsUpi
          ? "Pay with any UPI app — GPay, PhonePe, Paytm"
          : "Scan to view this bill",
        6.5,
        "Helvetica",
        2,
      );
    }
    center("Powered by Scan to Order", 6, "Helvetica", 0);

    doc.end();
  });
}
