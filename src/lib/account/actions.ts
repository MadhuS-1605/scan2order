"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createOtp, verifyOtp } from "@/lib/messaging/otp";
import { sendWhatsApp, sendWhatsAppTemplate, sendOtpSms } from "@/lib/messaging/provider";
import { env } from "@/lib/env";
import {
  createCustomerSession,
  destroyCustomerSession,
  getCustomerSession,
} from "@/lib/customer/session";

export async function requestLoginOtpAction(args: {
  phone: string;
}): Promise<{ ok: boolean; mocked?: boolean; error?: string }> {
  const phone = args.phone.trim();
  if (!/^\+?\d{7,15}$/.test(phone))
    return { ok: false, error: "Enter a valid mobile number." };
  let code: string;
  try {
    code = await createOtp(phone, "LOGIN");
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not send code." };
  }
  const res =
    env.messaging.provider === "meta"
      ? await sendWhatsAppTemplate(phone, env.messaging.meta.otpTemplate, [code])
      : await sendWhatsApp(
          phone,
          `Your Scan2Order login code is ${code}. It expires in 5 minutes.`,
        );
  if (!res.ok) {
    // WhatsApp didn't go through (often the number isn't on WhatsApp) — try the
    // low-cost SMS fallback before giving up.
    const sms = await sendOtpSms(phone, code);
    if (sms.ok) return { ok: true, mocked: sms.mocked };
    return { ok: false, error: res.error ?? "Could not send code." };
  }
  return { ok: true, mocked: res.mocked };
}

export async function verifyLoginOtpAction(args: {
  phone: string;
  code: string;
}): Promise<{ ok: boolean; error?: string }> {
  const phone = args.phone.trim();
  const result = await verifyOtp(phone, "LOGIN", args.code.trim());
  if (!result.ok) return { ok: false, error: result.error };

  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone },
    update: {},
  });
  await createCustomerSession({ customerId: customer.id, phone });
  return { ok: true };
}

export async function updateCustomerNameAction(
  formData: FormData,
): Promise<void> {
  const session = await getCustomerSession();
  if (!session) return;
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  await prisma.customer.update({
    where: { id: session.customerId },
    data: { name: name || null },
  });
  revalidatePath("/account");
}

export async function logoutAccountAction(): Promise<void> {
  await destroyCustomerSession();
  redirect("/account");
}

// Right to erasure (DPDP): delete the customer's profile and strip personal
// data (name/phone) from their past orders. Order records are kept for the
// restaurant's books but anonymised; loyalty + feedback links drop via SetNull.
export async function deleteAccountDataAction(): Promise<void> {
  const session = await getCustomerSession();
  if (!session) redirect("/account");
  await prisma.order.updateMany({
    where: { customerId: session.customerId },
    data: { customerId: null, customerName: null, customerPhone: null },
  });
  await prisma.customer.delete({ where: { id: session.customerId } });
  await destroyCustomerSession();
  redirect("/account?deleted=1");
}
