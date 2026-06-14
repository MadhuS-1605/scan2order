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

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

// Creates and stores a hashed OTP, returning the plain code to send.
export async function createOtp(
  phone: string,
  purpose: OtpPurpose,
): Promise<string> {
  const recent = await prisma.otpVerification.count({
    where: { phone, purpose, createdAt: { gt: new Date(Date.now() - RATE_WINDOW_MS) } },
  });
  if (recent >= MAX_PER_WINDOW) throw new OtpRateLimitError();

  const code = generateOtp();
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
