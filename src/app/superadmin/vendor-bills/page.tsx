import { redirect } from "next/navigation";
import { CreditCard, AlertTriangle, Repeat } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/platform/actions";
import { platformCan } from "@/lib/platform/roles";
import { toNumber, formatMoney } from "@/lib/utils";
import { StatCard } from "@/components/superadmin/stat-card";
import { VendorBillsManager } from "./vendor-bills-manager";

// Monthly-equivalent of a bill regardless of its billing cycle, so spend
// across mixed cycles (monthly/quarterly/yearly) can be summed meaningfully.
function monthlyEquivalent(amount: number, cycle: string): number {
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  if (cycle === "ONE_TIME") return 0;
  return amount;
}

export default async function VendorBillsPage() {
  const s = await requireSuperAdmin();
  if (!platformCan(s.platformRole, "billing.manage")) redirect("/superadmin");

  const bills = await prisma.platformSubscription.findMany({
    orderBy: { nextRenewalAt: "asc" },
  });

  const active = bills.filter((b) => b.isActive);
  const monthlySpend = active.reduce((sum, b) => sum + monthlyEquivalent(toNumber(b.amount), b.billingCycle), 0);
  const in7Days = new Date(Date.now() + 7 * 86_400_000);
  const dueSoon = active.filter((b) => b.nextRenewalAt <= in7Days && b.billingCycle !== "ONE_TIME");
  const overdue = active.filter((b) => b.nextRenewalAt < new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Vendor bills</h1>
        <p className="text-sm text-ink/45">
          What the platform itself pays (Razorpay, Resend, hosting, WhatsApp, ...) — distinct from tenant revenue on the Revenue page.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Active bills" value={String(active.length)} sub={`${bills.length} total tracked`} icon={CreditCard} />
        <StatCard label="Monthly spend" value={formatMoney(monthlySpend)} sub="normalized across cycles" icon={Repeat} />
        <StatCard label="Due within 7 days" value={String(dueSoon.length)} sub="upcoming renewals" icon={AlertTriangle} />
        <StatCard label="Overdue" value={String(overdue.length)} sub="past their renewal date" icon={AlertTriangle} />
      </div>

      <VendorBillsManager
        bills={bills.map((b) => ({
          id: b.id,
          vendor: b.vendor,
          description: b.description,
          amount: b.amount.toString(),
          currency: b.currency,
          billingCycle: b.billingCycle,
          nextRenewalAt: b.nextRenewalAt.toISOString(),
          autoRenews: b.autoRenews,
          paymentNote: b.paymentNote,
          isActive: b.isActive,
        }))}
      />
    </div>
  );
}
