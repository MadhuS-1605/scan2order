import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Read at runtime (not module top-level): globalSetup regenerates fixtures.json
// after Playwright has already loaded the spec files.
function fixtures() {
  return JSON.parse(readFileSync("e2e/fixtures.json", "utf8")) as {
    owner2Email: string;
    password: string;
    paidOrderId: string;
  };
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/signin");
  await page.getByPlaceholder("you@restaurant.com").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin/);
}

test("owner can refund a counter-paid order", async ({ page }) => {
  // The refund action does several sequential writes (refund row, order
  // update, audit log), then Next.js re-renders the ENTIRE order-detail RSC
  // tree — which means re-running the admin layout's own query waterfall
  // (session, restaurant, announcement, notification counts, attendance,
  // group membership) on top of the order page's own queries. On a shared CI
  // runner this combination has been observed to occasionally exceed 20s
  // even though the action itself succeeds (confirmed by a subsequent retry
  // finding the order already refunded). Raise the WHOLE TEST's timeout, not
  // just the assertion's — an assertion timeout longer than the enclosing
  // test timeout is a no-op once the outer clock runs out.
  test.setTimeout(60_000);

  const fx = fixtures();
  await signIn(page, fx.owner2Email, fx.password);

  await page.goto(`/admin/orders/${fx.paidOrderId}`);
  // The Refunds card is shown (owner has the refunds permission, order is paid).
  await expect(page.getByRole("heading", { name: "Refunds" })).toBeVisible();

  // Counter payment → "Record refund" (manual note). Defaults to the full amount.
  await page.getByRole("button", { name: /record refund/i }).click();
  // Order flips to REFUNDED once fully refunded.
  await expect(page.getByText("REFUNDED", { exact: true })).toBeVisible({ timeout: 45_000 });
});
