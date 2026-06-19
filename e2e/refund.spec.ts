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
  const fx = fixtures();
  await signIn(page, fx.owner2Email, fx.password);

  await page.goto(`/admin/orders/${fx.paidOrderId}`);
  // The Refunds card is shown (owner has the refunds permission, order is paid).
  await expect(page.getByRole("heading", { name: "Refunds" })).toBeVisible();

  // Counter payment → "Record refund" (manual note). Defaults to the full amount.
  await page.getByRole("button", { name: /record refund/i }).click();
  // Order flips to REFUNDED once fully refunded.
  await expect(page.getByText("REFUNDED", { exact: true })).toBeVisible();
});
