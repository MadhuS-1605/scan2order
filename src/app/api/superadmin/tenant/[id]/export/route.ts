import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";

// Full(ish) JSON export of one tenant's data — for offboarding / GDPR. Super-admin
// only. Orders capped to the most recent 1000 to keep the payload bounded.
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const me = await prisma.adminUser.findUnique({ where: { id: session.sub }, select: { isSuperAdmin: true } });
  if (!me?.isSuperAdmin) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      config: true,
      categories: { orderBy: { sortOrder: "asc" } },
      menuItems: { orderBy: { sortOrder: "asc" } },
      tables: true,
      admins: { select: { id: true, name: true, email: true, username: true, role: true, disabled: true } },
      planPayments: true,
      orders: { orderBy: { createdAt: "desc" }, take: 1000, include: { items: true } },
    },
  });
  if (!restaurant) return new Response("Not found", { status: 404 });

  const body = JSON.stringify({ exportedAt: new Date().toISOString(), restaurant }, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tenant-${restaurant.slug}.json"`,
    },
  });
}
