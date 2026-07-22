"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { recordPlatformAudit } from "@/lib/audit";
import { z } from "zod";
import type { ActionState } from "@/lib/validation";

// The platform's own vendor bills (Razorpay, Resend, hosting, ...) — distinct
// from tenant billing (src/app/superadmin/billing). Gated the same way as
// revenue (billing.manage), since this is money the company itself owes.
async function requireBillingOperator() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "billing.manage")) redirect("/superadmin");
  return s;
}

const vendorBillSchema = z.object({
  vendor: z.string().trim().min(1, "Vendor name is required").max(80),
  description: z.string().trim().max(200).optional(),
  amount: z.coerce.number().min(0),
  currency: z.string().trim().min(1).max(10).default("INR"),
  billingCycle: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "ONE_TIME"]),
  nextRenewalAt: z.coerce.date(),
  autoRenews: z.coerce.boolean().default(false),
  paymentNote: z.string().trim().max(200).optional(),
});

function revalidate() {
  revalidatePath("/superadmin/vendor-bills");
}

export async function createVendorBillAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireBillingOperator();
  const parsed = vendorBillSchema.safeParse({
    vendor: formData.get("vendor"),
    description: formData.get("description") || undefined,
    amount: formData.get("amount"),
    currency: formData.get("currency") || "INR",
    billingCycle: formData.get("billingCycle"),
    nextRenewalAt: formData.get("nextRenewalAt"),
    autoRenews: formData.get("autoRenews") === "on",
    paymentNote: formData.get("paymentNote") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  await prisma.platformSubscription.create({
    data: {
      vendor: d.vendor,
      description: d.description || null,
      amount: d.amount,
      currency: d.currency,
      billingCycle: d.billingCycle,
      nextRenewalAt: d.nextRenewalAt,
      autoRenews: d.autoRenews,
      paymentNote: d.paymentNote || null,
    },
  });
  await recordPlatformAudit(session, "vendorBill.created", d.vendor);
  revalidate();
  return { ok: true, message: `${d.vendor} added.` };
}

// Bumps nextRenewalAt forward by one billing cycle from today — the "I just
// paid this" button, so the operator doesn't have to hand-compute the date.
export async function markVendorBillRenewedAction(formData: FormData): Promise<void> {
  const session = await requireBillingOperator();
  const id = String(formData.get("id"));
  const bill = await prisma.platformSubscription.findUnique({ where: { id } });
  if (!bill) return;

  const next = new Date(bill.nextRenewalAt);
  if (bill.billingCycle === "MONTHLY") next.setMonth(next.getMonth() + 1);
  else if (bill.billingCycle === "QUARTERLY") next.setMonth(next.getMonth() + 3);
  else if (bill.billingCycle === "YEARLY") next.setFullYear(next.getFullYear() + 1);
  // ONE_TIME: leave the date as-is (there's no "next" renewal).

  await prisma.platformSubscription.update({
    where: { id },
    data: { nextRenewalAt: next },
  });
  await recordPlatformAudit(session, "vendorBill.renewed", bill.vendor);
  revalidate();
}

export async function toggleVendorBillActiveAction(formData: FormData): Promise<void> {
  const session = await requireBillingOperator();
  const id = String(formData.get("id"));
  const bill = await prisma.platformSubscription.findUnique({ where: { id } });
  if (!bill) return;
  await prisma.platformSubscription.update({
    where: { id },
    data: { isActive: !bill.isActive },
  });
  await recordPlatformAudit(session, bill.isActive ? "vendorBill.deactivated" : "vendorBill.reactivated", bill.vendor);
  revalidate();
}

export async function deleteVendorBillAction(formData: FormData): Promise<void> {
  const session = await requireBillingOperator();
  const id = String(formData.get("id"));
  const bill = await prisma.platformSubscription.findUnique({ where: { id } });
  if (!bill) return;
  await prisma.platformSubscription.delete({ where: { id } });
  await recordPlatformAudit(session, "vendorBill.deleted", bill.vendor);
  revalidate();
}
