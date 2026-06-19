import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const { session, restaurant } = await getCurrentRestaurant("staff");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  const staff = await prisma.adminUser.findMany({
    where: { restaurantId: restaurant.id },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "scan.to";
  const staffLoginUrl = restaurant.subdomain
    ? `${restaurant.subdomain}.${platformDomain}/signin`
    : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium text-ink">{t(d, "staff.title")}</h1>
        <p className="text-sm text-ink/45">
          {t(d, "staff.subtitle")}
        </p>
        {staffLoginUrl ? (
          <p className="mt-1 text-sm text-ink/55">
            {t(d, "staff.signInAt")}{" "}
            <span className="font-medium text-brand-600">{staffLoginUrl}</span>{" "}
            {t(d, "staff.withUsernamePassword")}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/55">
            {t(d, "staff.setWebAddressPre")}{" "}
            <span className="font-medium">{t(d, "staff.settingsWebAddress")}</span> {t(d, "staff.setWebAddressPost")}
          </p>
        )}
      </div>
      <StaffManager
        currentUserId={session.sub}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          username: s.username,
          role: s.role,
          disabled: s.disabled,
        }))}
      />
    </div>
  );
}
