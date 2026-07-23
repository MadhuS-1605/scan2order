import { cookies } from "next/headers";
import { ADMIN_LOCALE_COOKIE, dictFor, t } from "@/lib/i18n";
import { getCurrentRestaurant } from "@/lib/restaurant";
import { SettingsForms } from "./settings-forms";

export default async function SettingsPage() {
  const { restaurant, config } = await getCurrentRestaurant("settings");
  const d = dictFor((await cookies()).get(ADMIN_LOCALE_COOKIE)?.value);

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl font-medium text-ink">{t(d, "settings.title")}</h1>
      <SettingsForms
        tenant={{
          subdomain: restaurant.subdomain,
          customDomain: config.customDomain,
        }}
        profile={{
          name: restaurant.name,
          type: restaurant.type,
          phone: restaurant.phone,
          email: restaurant.email,
          addressLine: restaurant.addressLine,
          city: restaurant.city,
          state: restaurant.state,
          postalCode: restaurant.postalCode,
          fssaiNumber: restaurant.fssaiNumber,
          logoUrl: restaurant.logoUrl,
          brandColor: restaurant.brandColor,
        }}
        config={{
          orderConfirmation: config.orderConfirmation,
          paymentTiming: config.paymentTiming,
          onlinePaymentEnabled: config.onlinePaymentEnabled,
          counterPaymentEnabled: config.counterPaymentEnabled,
          gstMode: config.gstMode,
          gstNumber: config.gstNumber,
          gstPercentage: config.gstPercentage.toString(),
          serviceChargePercent: config.serviceChargePercent.toString(),
          reviewUrl: config.reviewUrl,
          happyHourEnabled: config.happyHourEnabled,
          happyHourFrom: config.happyHourFrom,
          happyHourTo: config.happyHourTo,
          happyHourPercent: config.happyHourPercent.toString(),
          languages: config.languages,
          kotPrinterHost: config.kotPrinterHost,
          kotPrinterPort: config.kotPrinterPort,
          razorpayKeyId: config.razorpayKeyId,
          hasRazorpaySecret: Boolean(config.razorpayKeySecret),
          whatsappFrom: config.whatsappFrom,
          upiId: config.upiId,
          upiName: config.upiName,
          featureReservations: config.featureReservations,
          featureRooms: config.featureRooms,
          featureBanquets: config.featureBanquets,
          featureBar: config.featureBar,
          featureAttendance: config.featureAttendance,
          timezone: config.timezone,
          openTime: config.openTime,
          closeTime: config.closeTime,
          orderingPaused: config.orderingPaused,
          billFooterMessage: config.billFooterMessage,
          defaultPrepMinutes: config.defaultPrepMinutes,
          minOrderAmount: config.minOrderAmount,
          dailyReportEmail: config.dailyReportEmail,
          pickupEnabled: config.pickupEnabled,
          deliveryEnabled: config.deliveryEnabled,
          requireDinerLocation: config.requireDinerLocation,
          latitude: config.latitude,
          longitude: config.longitude,
          geofenceRadiusM: config.geofenceRadiusM,
          orderRadiusM: config.orderRadiusM,
        }}
      />
    </div>
  );
}
