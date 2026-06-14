import { getMenuContext } from "@/lib/customer/menu-context";
import { ScanPrompt } from "@/components/diner/scan-prompt";
import { CheckoutForm } from "@/components/diner/checkout-form";

export default async function CheckoutPage() {
  const ctx = await getMenuContext();
  if (!ctx) return <ScanPrompt />;

  return (
    <CheckoutForm
      qrToken={ctx.qrToken}
      restaurantId={ctx.restaurantId}
      happyHourPercent={ctx.happyHourPercent}
      restaurant={ctx.restaurant}
      table={ctx.table}
      config={ctx.config}
      items={ctx.items}
    />
  );
}
