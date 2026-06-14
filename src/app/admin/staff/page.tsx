import { getCurrentRestaurant } from "@/lib/restaurant";
import { prisma } from "@/lib/db";
import { StaffManager } from "./staff-manager";

export default async function StaffPage() {
  const { session, restaurant } = await getCurrentRestaurant("staff");

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
        <h1 className="font-display text-3xl font-medium text-ink">Staff</h1>
        <p className="text-sm text-ink/45">
          Add team members and control what each can access.
        </p>
        {staffLoginUrl ? (
          <p className="mt-1 text-sm text-ink/55">
            Staff sign in at{" "}
            <span className="font-medium text-brand-600">{staffLoginUrl}</span>{" "}
            with their username &amp; password.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/55">
            Set your web address in{" "}
            <span className="font-medium">Settings → Web address</span> so staff
            get a sign-in link.
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
