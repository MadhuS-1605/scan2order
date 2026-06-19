// Lightweight, dependency-free admin i18n (mirrors the diner-side localizer
// pattern; avoids coupling to this modified Next 16's internals). The admin
// locale is stored in the `sto_admin_locale` cookie. Translate incrementally:
// add keys here + render with `t(...)` (server) or `useT()` (client).

export type Locale = "en" | "hi";
export const ADMIN_LOCALES: { code: Locale; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
];
export const ADMIN_LOCALE_COOKIE = "sto_admin_locale";

export type Dict = Record<string, string>;

const en: Dict = {
  "nav.Main": "Main",
  "nav.Manage": "Manage",
  "nav.Insights": "Insights",
  "nav.Business": "Business",
  "nav.Overview": "Overview",
  "nav.Notifications": "Notifications",
  "nav.Orders": "Orders",
  "nav.Floor": "Floor",
  "nav.Kitchen": "Kitchen",
  "nav.Bar": "Bar",
  "nav.Monitor": "Monitor",
  "nav.Menu": "Menu",
  "nav.Coupons": "Coupons",
  "nav.Inventory": "Inventory",
  "nav.Tables & QR": "Tables & QR",
  "nav.Reservations": "Reservations",
  "nav.Rooms": "Rooms",
  "nav.Banquets": "Banquets",
  "nav.Analytics": "Analytics",
  "nav.Feedback": "Feedback",
  "nav.Export": "Export",
  "nav.Staff": "Staff",
  "nav.Attendance": "Attendance",
  "nav.Properties": "Properties",
  "nav.Audit log": "Audit log",
  "nav.Integrations": "Integrations",
  "nav.Plan & billing": "Plan & billing",
  "nav.Settings": "Settings",
  "common.signOut": "Sign out",
};

const hi: Dict = {
  "nav.Main": "मुख्य",
  "nav.Manage": "प्रबंधन",
  "nav.Insights": "विश्लेषण",
  "nav.Business": "व्यवसाय",
  "nav.Overview": "अवलोकन",
  "nav.Notifications": "सूचनाएँ",
  "nav.Orders": "ऑर्डर",
  "nav.Floor": "फ़्लोर",
  "nav.Kitchen": "रसोई",
  "nav.Bar": "बार",
  "nav.Monitor": "मॉनिटर",
  "nav.Menu": "मेन्यू",
  "nav.Coupons": "कूपन",
  "nav.Inventory": "इन्वेंट्री",
  "nav.Tables & QR": "टेबल और QR",
  "nav.Reservations": "आरक्षण",
  "nav.Rooms": "कमरे",
  "nav.Banquets": "बैंक्वेट",
  "nav.Analytics": "एनालिटिक्स",
  "nav.Feedback": "प्रतिक्रिया",
  "nav.Export": "एक्सपोर्ट",
  "nav.Staff": "स्टाफ",
  "nav.Attendance": "उपस्थिति",
  "nav.Properties": "प्रॉपर्टीज़",
  "nav.Audit log": "ऑडिट लॉग",
  "nav.Integrations": "इंटीग्रेशन",
  "nav.Plan & billing": "प्लान और बिलिंग",
  "nav.Settings": "सेटिंग्स",
  "common.signOut": "साइन आउट",
};

const DICTS: Record<Locale, Dict> = { en, hi };

export function dictFor(locale: string | undefined): Dict {
  return DICTS[(locale as Locale)] ?? en;
}

// Translate a key; falls back to the key's text after "nav." etc. so untranslated
// strings still render readably.
export function t(dict: Dict, key: string): string {
  return dict[key] ?? key.replace(/^[a-z]+\./, "");
}
