import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Public, indexable marketing/legal pages only. Per-tenant ordering pages are
// private (gated by QR token / auth) and intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/signin", "/signup", "/privacy", "/terms"];
  return routes.map((path) => ({
    url: `${base}${path || "/"}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.6,
  }));
}
