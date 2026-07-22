import "server-only";
import PDFDocument from "pdfkit";

// Internal record of what a restaurant entered during onboarding — emailed to
// the platform team when they finish setup (see completeOnboardingAction).
export type OnboardingSummaryData = {
  restaurantName: string;
  type: string;
  slug: string;
  subdomain: string | null;
  ownerName: string;
  ownerEmail: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  gstMode: string;
  gstNumber: string | null;
  serviceModel: string;
  paymentTiming: string;
  onlinePaymentEnabled: boolean;
  counterPaymentEnabled: boolean;
  categoryCount: number;
  itemCount: number;
  tableCount: number;
  roomCount: number;
  completedAt: Date;
};

export async function generateOnboardingSummaryPdf(data: OnboardingSummaryData): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#1c1917").text("New venue onboarded", left, 48);
  doc.font("Helvetica").fontSize(9).fillColor("#666");
  doc.text(
    `Completed: ${data.completedAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
    { align: "right" },
  );

  doc.moveDown(1.5);

  const row = (label: string, value: string) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#1c1917").text(label, left, doc.y, { continued: true, width: 160 });
    doc.font("Helvetica").fillColor("#333").text(value || "—");
  };
  const section = (title: string) => {
    doc.moveDown(1);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#1c1917").text(title, left, doc.y);
    doc.moveTo(left, doc.y + 2).lineTo(right, doc.y + 2).strokeColor("#bbb").lineWidth(1).stroke();
    doc.moveDown(0.5);
  };

  section("Venue");
  row("Name:", data.restaurantName);
  row("Type:", data.type);
  row("Username:", data.subdomain ?? data.slug);
  row("Phone:", data.phone ?? "—");
  row("Address:", [data.address, data.city, data.state].filter(Boolean).join(", ") || "—");
  row("GST:", data.gstMode === "NONE" ? "Not registered" : `${data.gstMode} — ${data.gstNumber ?? "unverified"}`);

  section("Owner account");
  row("Name:", data.ownerName);
  row("Email:", data.ownerEmail ?? "—");

  section("Setup");
  row("Service model:", data.serviceModel);
  row("Payment timing:", data.paymentTiming);
  row("Online payment:", data.onlinePaymentEnabled ? "Enabled" : "Disabled");
  row("Pay at counter:", data.counterPaymentEnabled ? "Enabled" : "Disabled");
  row("Menu:", `${data.categoryCount} categories, ${data.itemCount} items`);
  row("Tables / rooms:", `${data.tableCount} tables, ${data.roomCount} rooms`);

  doc.end();
  return done;
}
