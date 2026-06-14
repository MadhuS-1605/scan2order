import "server-only";
import { cookies } from "next/headers";

// The scanned table's QR token, stashed in a cookie by proxy.ts so the diner-
// facing pages (/menu, /order/...) work with clean URLs. Returns null if the
// diner hasn't scanned a table this session.
export async function getActiveTableToken(): Promise<string | null> {
  const store = await cookies();
  return store.get("sto_table")?.value ?? null;
}
