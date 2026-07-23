import { getMenuContext } from "@/lib/customer/menu-context";
import { ScanPrompt } from "@/components/diner/scan-prompt";
import { CartView } from "@/components/diner/cart-view";
import { BrandTheme } from "@/components/diner/brand-theme";

export default async function CartPage() {
  const ctx = await getMenuContext();
  if (!ctx) return <ScanPrompt />;

  return (
    <BrandTheme color={ctx.restaurant.brandColor}>
      <CartView
        restaurantId={ctx.restaurantId}
        happyHourPercent={ctx.happyHourPercent}
        restaurant={ctx.restaurant}
        table={ctx.table}
        items={ctx.items}
      />
    </BrandTheme>
  );
}
