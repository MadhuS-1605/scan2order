import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Index the public marketing pages; keep the per-tenant app and private areas
// (admin, platform, the diner ordering funnel, API) out of search results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/superadmin",
        "/onboarding",
        "/api/",
        "/menu",
        "/cart",
        "/checkout",
        "/order",
        "/payment",
        "/account",
        "/t/",
        "/r/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
