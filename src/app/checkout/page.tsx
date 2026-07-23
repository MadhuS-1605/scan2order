import { getMenuContext } from "@/lib/customer/menu-context";
import { ScanPrompt } from "@/components/diner/scan-prompt";
import { CheckoutForm } from "@/components/diner/checkout-form";
import { BrandTheme } from "@/components/diner/brand-theme";

export default async function CheckoutPage() {
  const ctx = await getMenuContext();
  if (!ctx) return <ScanPrompt />;

  return (
    <BrandTheme color={ctx.restaurant.brandColor}>
      <CheckoutForm
        qrToken={ctx.qrToken}
        restaurantId={ctx.restaurantId}
        happyHourPercent={ctx.happyHourPercent}
        restaurant={ctx.restaurant}
        table={ctx.table}
        config={ctx.config}
        items={ctx.items}
      />
    </BrandTheme>
  );
}
