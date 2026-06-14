import "server-only";
import { prisma } from "@/lib/db";

// Records a sensitive admin action. Best-effort — never throws into the caller.
export async function recordAudit(
  restaurantId: string,
  actor: { sub?: string; name?: string } | null,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId,
        actorId: actor?.sub ?? null,
        actorName: actor?.name ?? null,
        action,
        detail: detail?.slice(0, 300) ?? null,
      },
    });
  } catch {
    // auditing must not break the action it accompanies
  }
}

export const AUDIT_LABELS: Record<string, string> = {
  "staff.created": "Added a team member",
  "staff.role_changed": "Changed a member's role",
  "staff.removed": "Removed a team member",
  "settings.profile": "Updated business profile",
  "settings.operations": "Updated operations & tax",
  "settings.payment": "Updated payment credentials",
  "settings.web_address": "Updated web address",
  "coupon.created": "Created a coupon",
  "coupon.deleted": "Deleted a coupon",
  "menu.item_updated": "Edited a menu item",
  "menu.item_deleted": "Deleted a menu item",
  "kot.printed": "Printed a kitchen ticket",
  "property.created": "Added a property",
  "property.switched": "Switched active property",
  "room.checkout": "Settled room charges at checkout",
  "banquet.created": "Created a banquet booking",
  "integration.connected": "Connected an integration",
  "integration.disconnected": "Disconnected an integration",
  "plan.changed": "Changed subscription plan",
  "menu.template_applied": "Applied a starter menu",
  "order.staff_created": "Created an order for a guest",
  "order.item_added": "Added an item to an order",
  "order.item_qty": "Changed an order item quantity",
  "staff.password_reset": "Reset a member's password",
  "staff.disabled": "Disabled a team member",
  "staff.enabled": "Re-enabled a team member",
  "attendance.marked": "Recorded staff attendance",
  "order.blocked_remote": "Blocked an off-site order attempt",
  "order.refund_due": "Refund due on a cancelled paid order",
  "order.table_changed": "Moved an order to another table",
  "table.cleared": "Cleared a table (walk-out)",
};
