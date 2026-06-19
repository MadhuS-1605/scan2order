import { test, expect } from "@playwright/test";

// Admin auth happy path against the seeded demo owner (demo@scan.to / password123).
test.describe("admin", () => {
  test("owner can sign in and reach the dashboard", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder("you@restaurant.com").fill("demo@scan.to");
    await page.locator('input[name="password"]').fill("password123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByText("Admin dashboard")).toBeVisible();
  });

  test("wrong password is rejected", async ({ page }) => {
    await page.goto("/signin");
    await page.getByPlaceholder("you@restaurant.com").fill("demo@scan.to");
    await page.locator('input[name="password"]').fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/signin/);
  });
});
