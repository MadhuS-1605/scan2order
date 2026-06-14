import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/guards";
import { qrDataUrl, tableMenuUrl } from "@/lib/qr";
import { getBaseUrl } from "@/lib/request";
import { STEPS } from "@/lib/onboarding/steps";
import { Stepper } from "./stepper";
import { ProfileStep } from "./steps/profile-step";
import { MenuStep } from "./steps/menu-step";
import { SettingsStep } from "./steps/settings-step";
import { TablesStep } from "./steps/tables-step";

export default async function OnboardingPage() {
  const session = await requireAdmin();

  // No restaurant yet -> start with the profile step.
  if (!session.restaurantId) {
    return (
      <Shell stepIndex={0}>
        <ProfileStep restaurant={null} />
      </Shell>
    );
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    include: {
      config: true,
      categories: { orderBy: { sortOrder: "asc" } },
      menuItems: { orderBy: { createdAt: "asc" } },
      tables: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!restaurant || !restaurant.config) redirect("/signin");
  if (restaurant.config.onboardingCompleted) redirect("/admin");

  const stepIndex = restaurant.config.onboardingStep;
  const step = STEPS[stepIndex] ?? "profile";
  const baseUrl = await getBaseUrl();

  return (
    <Shell stepIndex={stepIndex}>
      {step === "profile" && <ProfileStep restaurant={restaurant} />}
      {step === "menu" && (
        <MenuStep
          categories={restaurant.categories}
          items={restaurant.menuItems.map((i) => ({
            ...i,
            price: i.price.toString(),
          }))}
        />
      )}
      {step === "settings" && (
        <SettingsStep
          config={{
            orderConfirmation: restaurant.config.orderConfirmation,
            paymentTiming: restaurant.config.paymentTiming,
            onlinePaymentEnabled: restaurant.config.onlinePaymentEnabled,
            counterPaymentEnabled: restaurant.config.counterPaymentEnabled,
            gstMode: restaurant.config.gstMode,
            gstNumber: restaurant.config.gstNumber,
            gstPercentage: restaurant.config.gstPercentage.toString(),
          }}
        />
      )}
      {step === "tables" && (
        <TablesStep
          tables={await Promise.all(
            restaurant.tables.map(async (t) => ({
              id: t.id,
              label: t.label,
              seats: t.seats,
              url: tableMenuUrl(
                baseUrl,
                restaurant.subdomain ?? restaurant.slug,
                t.label,
              ),
              qr: await qrDataUrl(
                tableMenuUrl(
                  baseUrl,
                  restaurant.subdomain ?? restaurant.slug,
                  t.label,
                ),
              ),
            })),
          )}
        />
      )}
    </Shell>
  );
}

function Shell({
  stepIndex,
  children,
}: {
  stepIndex: number;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-grain">
      <header className="border-b border-sand-200 bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-5 sm:px-6">
          <h1 className="font-display text-2xl text-ink">
            Set up your restaurant
          </h1>
          <p className="mt-0.5 text-sm text-ink/55">
            A few steps and you&apos;re ready to take orders.
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6">
        <Stepper current={stepIndex} />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
