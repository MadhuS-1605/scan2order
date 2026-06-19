import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { CouponManager } from "./coupon-manager";

export default async function CouponsPage() {
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);
  const { restaurant } = await getCurrentRestaurant("menu");

  const coupons = await prisma.coupon.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "coupons.title")}</h1>
        <p className="text-sm text-ink/45">
          {t(d, "coupons.subtitle")}
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
