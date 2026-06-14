"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  signupSchema,
  signinSchema,
  staffSigninSchema,
  type ActionState,
} from "@/lib/validation";
import { landingFor } from "@/lib/auth/permissions";

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  const user = await prisma.adminUser.create({
    data: {
      name,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      role: "OWNER",
    },
  });

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: null,
  });

  redirect("/onboarding");
}

export async function signinAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({
    where: { email: email.toLowerCase() },
  });
  if (!user || user.disabled || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });

  redirect(user.restaurantId ? landingFor(user.role) : "/onboarding");
}

// Staff sign in scoped to their restaurant's code (subdomain) + username. The
// restaurant code arrives from the URL (/r/<code>/signin) as a hidden field.
export async function staffSigninAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = staffSigninSchema.safeParse({
    code: formData.get("code"),
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { code, username, password } = parsed.data;

  const user = await prisma.adminUser.findFirst({
    where: {
      username: username.toLowerCase(),
      disabled: false,
      restaurant: { subdomain: code.toLowerCase() },
    },
  });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect username or password." };
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    restaurantId: user.restaurantId,
  });

  redirect(landingFor(user.role));
}

export async function signoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}
