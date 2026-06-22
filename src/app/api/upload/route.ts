import { getSession } from "@/lib/auth/session";
import { uploadTenantImage, MAX_UPLOAD_BYTES } from "@/lib/storage/r2";

export const runtime = "nodejs";

// Tenant image upload. Files land under the caller's own per-tenant prefix
// (derived from the session), so a tenant can't write into another's folder.
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in." }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const kindRaw = String(form.get("kind") ?? "misc");
  const kind = ["menu", "logo", "misc"].includes(kindRaw) ? kindRaw : "misc";

  if (!(file instanceof File)) return Response.json({ error: "No file uploaded." }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Image is too large (max 5 MB)." }, { status: 400 });

  // Restaurant folder once onboarded; otherwise scope to the user (e.g. logo
  // picked during the first onboarding step before the restaurant exists).
  const folder = session.restaurantId ? `tenants/${session.restaurantId}` : `users/${session.sub}`;
  const bytes = await file.arrayBuffer();
  const result = await uploadTenantImage({ folder, kind, bytes, contentType: file.type });
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ url: result.url });
}
