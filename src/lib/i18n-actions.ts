"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ADMIN_LOCALE_COOKIE, ADMIN_LOCALES } from "@/lib/i18n";

// Persist the admin's chosen language in a cookie (1 year).
export async function setAdminLocaleAction(locale: string): Promise<void> {
  const valid = ADMIN_LOCALES.some((l) => l.code === locale);
  if (!valid) return;
  (await cookies()).set(ADMIN_LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
  });
  revalidatePath("/admin", "layout");
}
