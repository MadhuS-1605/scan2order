import { prisma } from "@/lib/db";
import { getMenuContext } from "@/lib/customer/menu-context";
import { CustomerMenu } from "@/components/diner/customer-menu";
import { ScanPrompt } from "@/components/diner/scan-prompt";
import { BrandTheme } from "@/components/diner/brand-theme";

export default async function MenuPage({
  searchParams,
}: {
  searchParams: Promise<{ reorder?: string }>;
}) {
  const { reorder } = await searchParams;
  const ctx = await getMenuContext();
  if (!ctx) return <ScanPrompt />;

  let prefill: { itemId: string; qty: number }[] = [];
  if (reorder) {
    const prev = await prisma.order.findUnique({
      where: { id: reorder },
      include: { items: true },
    });
    if (prev && prev.restaurantId === ctx.restaurantId) {
      const byId = new Map(ctx.items.map((i) => [i.id, i]));
      prefill = prev.items
        .filter((it) => {
          const m = it.menuItemId ? byId.get(it.menuItemId) : undefined;
          return m && !m.modifierGroups.some((g) => g.required);
        })
        .map((it) => ({ itemId: it.menuItemId as string, qty: it.quantity }));
    }
  }

  return (
    <BrandTheme color={ctx.restaurant.brandColor}>
      <CustomerMenu
        qrToken={ctx.qrToken}
        restaurantId={ctx.restaurantId}
        prefill={prefill}
        happyHourPercent={ctx.happyHourPercent}
        ordering={ctx.ordering}
        languages={ctx.languages}
        restaurant={ctx.restaurant}
        table={ctx.table}
        categories={ctx.categories}
        items={ctx.items}
      />
    </BrandTheme>
  );
}
