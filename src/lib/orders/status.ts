// Pure order-status helpers (no server-only deps; safe to import anywhere).

export const ORDER_STATUSES = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Statuses the kitchen screen should display (confirmed work in progress).
export const KITCHEN_STATUSES: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "READY",
];

// Active (open) statuses for the admin orders board.
export const ACTIVE_STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
];

// The forward step shown on a single "advance" control, per status.
export function nextStatus(current: OrderStatus): OrderStatus | null {
  switch (current) {
    case "CONFIRMED":
      return "PREPARING";
    case "PREPARING":
      return "READY";
    case "READY":
      return "SERVED";
    case "SERVED":
      return "COMPLETED";
    default:
      return null;
  }
}

export const STATUS_ACTION_LABEL: Record<string, string> = {
  PREPARING: "Start preparing",
  READY: "Mark ready",
  SERVED: "Mark served",
  COMPLETED: "Complete order",
};

// Customer-facing progress steps for the status tracker.
export const CUSTOMER_STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PLACED", label: "Order placed" },
  { status: "CONFIRMED", label: "Confirmed" },
  { status: "PREPARING", label: "Preparing" },
  { status: "READY", label: "Ready" },
  { status: "SERVED", label: "Served" },
];
