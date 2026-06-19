import { test, expect } from "@playwright/test";

// Diner ordering happy path against the seeded demo restaurant (Spice Garden,
// slug spice-garden-demo, tables T1–T6).
test.describe("diner ordering", () => {
  test("scanning a table QR opens the menu", async ({ page }) => {
    // The table path resolves the QR token, drops the session cookie, and lands
    // on the clean /menu URL.
    await page.goto("/spice-garden-demo/T1");
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.getByRole("heading", { name: "Spice Garden (Demo)" })).toBeVisible();
    // At least one orderable item is shown.
    await expect(page.getByRole("button", { name: /^Add/ }).first()).toBeVisible();
  });

  test("a simple item can be added and taken to checkout", async ({ page }) => {
    await page.goto("/spice-garden-demo/T1");
    await expect(page).toHaveURL(/\/menu/);

    // Add the first no-modifier item (its button reads exactly "Add").
    const addBtn = page.getByRole("button", { name: "Add", exact: true }).first();
    await addBtn.click();

    // Go to the cart, then continue to checkout.
    await page.goto("/cart");
    await expect(page.getByText(/Your order/i)).toBeVisible();
    await page.getByRole("link", { name: /checkout|continue|pay/i }).first().click();
    await expect(page).toHaveURL(/\/checkout/);
  });
});
