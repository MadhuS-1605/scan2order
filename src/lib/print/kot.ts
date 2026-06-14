import { modifierSummary } from "@/lib/utils";

// Shape a KOT needs — built from a Prisma order with table + items included.
export type KotItem = {
  quantity: number;
  nameSnapshot: string;
  modifiers: unknown;
  notes: string | null;
};
export type KotData = {
  orderNumber: number;
  restaurantName: string;
  tableLabel: string | null;
  customerName: string | null;
  createdAt: Date;
  notes: string | null;
  items: KotItem[];
};

function fmtTime(d: Date): string {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- ESC/POS byte stream for a network thermal printer (TCP :9100) ---
const ESC = 0x1b;
const GS = 0x1d;

class EscPos {
  private parts: number[] = [];
  raw(...b: number[]) {
    this.parts.push(...b);
    return this;
  }
  text(s: string) {
    for (let i = 0; i < s.length; i++) this.parts.push(s.charCodeAt(i) & 0xff);
    return this;
  }
  line(s = "") {
    return this.text(s).raw(0x0a);
  }
  init() {
    return this.raw(ESC, 0x40);
  }
  align(a: "left" | "center" | "right") {
    return this.raw(ESC, 0x61, a === "center" ? 1 : a === "right" ? 2 : 0);
  }
  bold(on: boolean) {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }
  // GS ! n — bits 0x10 double-width, 0x01 double-height.
  size(big: boolean) {
    return this.raw(GS, 0x21, big ? 0x11 : 0x00);
  }
  feed(n = 1) {
    for (let i = 0; i < n; i++) this.parts.push(0x0a);
    return this;
  }
  cut() {
    return this.raw(GS, 0x56, 0x01); // partial cut
  }
  bytes(): Uint8Array {
    return Uint8Array.from(this.parts);
  }
}

export function kotEscPos(k: KotData): Uint8Array {
  const p = new EscPos().init();
  p.align("center").bold(true).line("*** KITCHEN ***").bold(false);
  p.line(k.restaurantName).feed(1);
  p.align("left");
  p.size(true).bold(true).line(`KOT #${k.orderNumber}`).size(false).bold(false);
  p.line(`Table: ${k.tableLabel ?? "Takeaway"}`);
  p.line(fmtTime(k.createdAt));
  if (k.customerName) p.line(`Customer: ${k.customerName}`);
  p.line("-".repeat(48));
  for (const it of k.items) {
    p.bold(true).line(`${it.quantity}x ${it.nameSnapshot}`).bold(false);
    const mods = modifierSummary(it.modifiers);
    if (mods) p.line(`   ${mods}`);
    if (it.notes) p.line(`   >> ${it.notes}`);
  }
  if (k.notes) p.line("-".repeat(48)).line(`Note: ${k.notes}`);
  p.feed(4).cut();
  return p.bytes();
}
