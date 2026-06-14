"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOnboardedAdmin } from "@/lib/auth/guards";
import { createSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { slugify } from "@/lib/utils";
import { recordAudit } from "@/lib/audit";
import { STEPS } from "@/lib/onboarding/steps";
import type { ActionState } from "@/lib/validation";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "restaurant";
  let slug = root;
  let n = 1;
  while (await prisma.restaurant.findUnique({ where: { slug } })) {
    slug = `${root}-${n++}`;
  }
  return slug;
}

// Ensure the owner has a PropertyGroup, retro-fitting their current restaurant
// and account into it the first time they add a second property.
async function ensureGroup(
  userId: string,
  currentRestaurantId: string,
  groupName: string,
): Promise<string> {
  const me = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { groupId: true },
  });
  if (me?.groupId) return me.groupId;

  const group = await prisma.propertyGroup.create({ data: { name: groupName } });
  await prisma.adminUser.update({
    where: { id: userId },
    data: { groupId: group.id },
  });
  await prisma.restaurant.update({
    where: { id: currentRestaurantId },
    data: { groupId: group.id },
  });
  return group.id;
}

// Switch the active property. Only properties within the owner's group are allowed.
export async function switchPropertyAction(formData: FormData): Promise<void> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "properties")) {
    redirect("/admin");
  }
  const targetId = String(formData.get("restaurantId") ?? "");
  if (!targetId || targetId === session.restaurantId) redirect("/admin");

  const me = await prisma.adminUser.findUnique({
    where: { id: session.sub },
    select: { groupId: true },
  });
  const target = await prisma.restaurant.findUnique({
    where: { id: targetId },
    select: { id: true, groupId: true, name: true },
  });
  // Must belong to the same group (and the owner must have a group).
  if (!me?.groupId || !target || target.groupId !== me.groupId) {
    redirect("/admin");
  }

  await createSession({ ...session, restaurantId: target.id });
  await recordAudit(target.id, session, "property.switched", target.name);
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

// Create a new property under the owner's group and switch to it.
export async function createPropertyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireOnboardedAdmin();
  if (!hasPermission(session.role, "properties")) {
    return { error: "Not allowed" };
  }
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "RESTAURANT");
  const city = String(formData.get("city") ?? "").trim();
  if (name.length < 2) return { error: "Enter a property name" };

  // Use the current restaurant's name as the group label on first creation.
  const current = await prisma.restaurant.findUnique({
    where: { id: session.restaurantId },
    select: { name: true },
  });
  const groupId = await ensureGroup(
    session.sub,
    session.restaurantId,
    current?.name ?? name,
  );

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      type: type as never,
      slug: await uniqueSlug(name),
      city: city || null,
      groupId,
      config: {
        create: {
          onboardingStep: STEPS.indexOf("done"),
          onboardingCompleted: true,
        },
      },
    },
  });

  await createSession({ ...session, restaurantId: restaurant.id });
  await recordAudit(restaurant.id, session, "property.created", name);
  revalidatePath("/admin", "layout");
  redirect("/admin/menu");
}
