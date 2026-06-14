import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";

// Readable QR entry: /<username-or-slug>/<table>. Resolves to the table's
// secure token and hands off to the ordering flow. In production the platform
// proxy rewrites <username>.<domain>/<table> here too.
export default async function TenantTablePage({
  params,
}: {
  params: Promise<{ tenant: string; table: string }>;
}) {
  const { tenant, table } = await params;
  const label = decodeURIComponent(table);

  const found = await prisma.restaurantTable.findFirst({
    where: {
      restaurant: {
        OR: [{ subdomain: tenant.toLowerCase() }, { slug: tenant.toLowerCase() }],
      },
      label: { equals: label, mode: "insensitive" },
      isActive: true,
    },
    select: { qrToken: true },
  });
  if (!found) notFound();

  redirect(`/t/${found.qrToken}`);
}
