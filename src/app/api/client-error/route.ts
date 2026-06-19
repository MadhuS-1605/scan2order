import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

// Funnels client-side render errors (from the error boundaries) into the same
// server log stream, so browser crashes aren't invisible.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string;
      stack?: string;
      digest?: string;
      url?: string;
    };
    reportError("client", new Error(body.message ?? "Client error"), {
      stack: body.stack,
      digest: body.digest,
      url: body.url,
    });
  } catch {
    // ignore malformed reports
  }
  return new Response("ok", { status: 200 });
}
