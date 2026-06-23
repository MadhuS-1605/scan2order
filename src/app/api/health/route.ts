import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight health probe for the platform (Railway healthcheck points here).
// Verifies the process is up AND the database is reachable — a far better signal
// than the marketing page, and it won't run pricing/render work on every check.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", db: "up", time: new Date().toISOString() });
  } catch {
    return Response.json(
      { status: "degraded", db: "down", time: new Date().toISOString() },
      { status: 503 },
    );
  }
}
