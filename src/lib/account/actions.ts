"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createOtp, verifyOtp } from "@/lib/messaging/otp";
import { sendWhatsApp } from "@/lib/messaging/provider";
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
  const res = await sendWhatsApp(
    phone,
    `Your Scan to Order login code is ${code}. It expires in 5 minutes.`,
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Could not send code." };
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
