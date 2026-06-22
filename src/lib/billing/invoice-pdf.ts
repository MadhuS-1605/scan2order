import "server-only";
import PDFDocument from "pdfkit";
import { GST_RATE } from "@/lib/plans";

// GST tax invoice for a tenant's subscription / overage payment. The charged
// amount is treated as GST-INCLUSIVE and decomposed into taxable value + GST, so
// the invoice total always equals what the tenant actually paid.

export type InvoiceData = {
  invoiceNo: string;
  date: Date;
  seller: { name: string; gstin: string; address: string; email: string };
  buyer: { name: string; gstin: string | null; address: string | null };
  lineDescription: string; // e.g. "Pro plan — 30 days" / "Usage overage — 2026-05"
  grossAmount: number; // total paid (GST-inclusive)
  paymentRef: string | null;
};

const money = (n: number) => `INR ${n.toFixed(2)}`;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const taxable = round2(data.grossAmount / (1 + GST_RATE));
  const gst = round2(data.grossAmount - taxable);

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // Header
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#1c1917").text("TAX INVOICE", left, 48);
  doc.font("Helvetica").fontSize(9).fillColor("#666");
  doc.text(`Invoice no: ${data.invoiceNo}`, { align: "right" });
  doc.text(`Date: ${data.date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`, { align: "right" });
  if (data.paymentRef) doc.text(`Payment ref: ${data.paymentRef}`, { align: "right" });

  doc.moveDown(1.5);

  // Seller / buyer blocks
  const blockTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1c1917").text("From", left, blockTop);
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(data.seller.name);
  if (data.seller.address) doc.text(data.seller.address, { width: 230 });
  if (data.seller.gstin) doc.text(`GSTIN: ${data.seller.gstin}`);
  if (data.seller.email) doc.text(data.seller.email);

  const colX = left + 270;
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#1c1917").text("Bill to", colX, blockTop);
  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(data.buyer.name, colX, doc.y, { width: 230 });
  if (data.buyer.address) doc.text(data.buyer.address, colX, doc.y, { width: 230 });
  if (data.buyer.gstin) doc.text(`GSTIN: ${data.buyer.gstin}`, colX, doc.y);

  doc.moveDown(2);

  // Line item table
  let y = Math.max(doc.y, blockTop + 90);
  const rule = (yy: number) => doc.moveTo(left, yy).lineTo(right, yy).strokeColor("#ddd").lineWidth(1).stroke();
  const amtX = right - 110;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1917");
  doc.text("Description", left, y);
  doc.text("Amount", amtX, y, { width: 110, align: "right" });
  y += 16;
  rule(y);
  y += 8;

  doc.font("Helvetica").fontSize(9).fillColor("#333");
  doc.text(data.lineDescription, left, y, { width: amtX - left - 10 });
  doc.text(money(taxable), amtX, y, { width: 110, align: "right" });
  y = doc.y + 10;
  rule(y);
  y += 10;

  // Totals
  const totalRow = (label: string, value: string, bold = false) => {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9).fillColor(bold ? "#1c1917" : "#444");
    doc.text(label, amtX - 130, y, { width: 130, align: "right" });
    doc.text(value, amtX, y, { width: 110, align: "right" });
    y += 16;
  };
  totalRow("Taxable value", money(taxable));
  totalRow(`GST @ ${Math.round(GST_RATE * 100)}%`, money(gst));
  totalRow("Total paid", money(data.grossAmount), true);

  doc.font("Helvetica").fontSize(8).fillColor("#999");
  doc.text(
    "Amount is inclusive of GST. This is a computer-generated invoice and does not require a signature.",
    left,
    doc.page.height - 80,
    { width: right - left, align: "center" },
  );

  doc.end();
  return done;
}
