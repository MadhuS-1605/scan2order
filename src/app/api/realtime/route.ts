import { getSession } from "@/lib/auth/session";
import { subscribe, type RealtimeEvent } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Server-Sent Events stream of order changes for the signed-in restaurant.
// Consumed by the admin orders board, kitchen screen, and monitor.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.restaurantId) {
    return new Response("Unauthorized", { status: 401 });
  }
  const restaurantId = session.restaurantId;
  const encoder = new TextEncoder();

  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval>;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: RealtimeEvent | { type: string; at: number }) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // controller already closed
        }
      };

      send({ type: "ping", at: Date.now() });
      unsubscribe = subscribe(restaurantId, send);
      // Keep the connection alive through proxies.
      heartbeat = setInterval(() => send({ type: "ping", at: Date.now() }), 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
