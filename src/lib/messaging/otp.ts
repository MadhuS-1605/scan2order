import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { OtpPurpose } from "@prisma/client";

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RATE_WINDOW_MS = 60 * 1000; // throttle window
const MAX_PER_WINDOW = 3; // max OTPs issued per phone+purpose per window

// Thrown when a phone requests OTPs too quickly (anti SMS/WhatsApp bombing).
export class OtpRateLimitError extends Error {
  constructor() {
    super("Too many requests. Please wait a minute before asking for another code.");
    this.name = "OtpRateLimitError";
  }
}

export function generateOtp(digits: number = 6): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}

// Phone-purpose OTPs may fall back to 2Factor SMS (src/lib/messaging/provider.ts
// sendOtpSms), whose DLT-registered template only accepts a 4-digit code — use
// 4 digits for those so the same code works whether it goes out over WhatsApp
// or the SMS fallback. ADMIN_LOGIN is email-only (never SMS, see the schema
// comment on OtpPurpose), so it keeps the stronger 6-digit code.
const OTP_DIGITS: Record<OtpPurpose, number> = {
  WHATSAPP_BILL: 4,
  LOGIN: 4,
  ADMIN_LOGIN: 6,
};

// Creates and stores a hashed OTP, returning the plain code to send.
export async function createOtp(
  phone: string,
  purpose: OtpPurpose,
): Promise<string> {
  const recent = await prisma.otpVerification.count({
    where: { phone, purpose, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= MAX_PER_WINDOW) throw new OtpRateLimitError();

  const code = generateOtp(OTP_DIGITS[purpose]);
  await prisma.otpVerification.create({
    data: {
      phone,
      purpose,
      codeHash: await bcrypt.hash(code, 8),
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  return code;
}

export async function verifyOtp(
  phone: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  const record = await prisma.otpVerification.findFirst({
    where: { phone, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, error: "Code expired. Request a new one." };
  if (record.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    await prisma.otpVerification.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, error: "Incorrect code." };
  }

  await prisma.otpVerification.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return { ok: true };
}
