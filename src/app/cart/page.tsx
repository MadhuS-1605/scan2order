import { getMenuContext } from "@/lib/customer/menu-context";
import { ScanPrompt } from "@/components/diner/scan-prompt";
import { CartView } from "@/components/diner/cart-view";

export default async function CartPage() {
  const ctx = await getMenuContext();
  if (!ctx) return <ScanPrompt />;

  return (
    <CartView
      restaurantId={ctx.restaurantId}
      happyHourPercent={ctx.happyHourPercent}
      restaurant={ctx.restaurant}
      table={ctx.table}
      items={ctx.items}
    />
  );
}
