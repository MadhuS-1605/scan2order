import { test, expect } from "@playwright/test";

// Full diner money path: order -> bill -> pay. The demo requires diner location
// (and has venue coords), so we grant geolocation at the venue to stay on the
// verified path. Razorpay has no keys in dev, so payment uses the mock route.
test.use({
  geolocation: { latitude: 12.9352, longitude: 77.6245 },
  permissions: ["geolocation"],
});

test.describe("diner money path", () => {
  test("place an order, then pay the bill (mock)", async ({ page }) => {
    await page.goto("/spice-garden-demo/T1");
    await expect(page).toHaveURL(/\/menu/);

    // Add a no-modifier item, then move to checkout.
    await page.getByRole("button", { name: "Add", exact: true }).first().click();
    await page.goto("/checkout");
    await expect(page).toHaveURL(/\/checkout/);

    // Place the order (PAY_AFTER demo → lands on the order status page).
    await page.getByRole("button", { name: /place order/i }).click();
    await expect(page).toHaveURL(/\/order\//);
    await expect(page.getByText(/your order number/i)).toBeVisible();

    // Open the bill and pay the full amount via the mock gateway.
    await page.getByRole("link", { name: /request bill|view bill|pay/i }).first().click();
    await expect(page).toHaveURL(/\/payment/);
    await page.getByRole("button", { name: /^Pay/ }).first().click();

    // Settled.
    await expect(page.getByText(/payment received/i)).toBeVisible();
  });
});
