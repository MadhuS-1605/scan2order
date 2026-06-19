import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Read at runtime — globalSetup rewrites fixtures.json after spec files load.
function fixtures() {
  return JSON.parse(readFileSync("e2e/fixtures.json", "utf8")) as { paidOrderId: string };
}

// Multi-tenant isolation: the demo owner must NOT be able to open an order that
// belongs to a different restaurant (Cafe Two). The order detail page scopes by
// restaurantId and calls notFound() on a mismatch.
test("an owner cannot open another restaurant's order", async ({ page }) => {
  const fx = fixtures();
  await page.goto("/signin");
  await page.getByPlaceholder("you@restaurant.com").fill("demo@scan.to");
  await page.locator('input[name="password"]').fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);

  await page.goto(`/admin/orders/${fx.paidOrderId}`);
  // Renders the app not-found page, not the cross-tenant order.
  await expect(page.getByText(/couldn.t find that/i)).toBeVisible();
});
