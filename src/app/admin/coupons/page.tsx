import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { CouponManager } from "./coupon-manager";

export default async function CouponsPage() {
  const { restaurant } = await getCurrentRestaurant("menu");

  const coupons = await prisma.coupon.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">Coupons</h1>
        <p className="text-sm text-ink/45">
          Discount codes diners enter at the bill.
        </p>
      </div>
      <CouponManager
        currency={restaurant.config!.currency}
        coupons={coupons.map((c) => ({
          id: c.id,
          code: c.code,
          type: c.type,
          value: c.value.toString(),
          minOrder: c.minOrder.toString(),
          maxDiscount: c.maxDiscount?.toString() ?? null,
          active: c.active,
          usageLimit: c.usageLimit,
          usedCount: c.usedCount,
        }))}
      />
    </div>
  );
}
