import { defineConfig, devices } from "@playwright/test";

// End-to-end tests against a running dev server + the seeded local DB.
// Run: `npm run db:seed` once, then `npm run test:e2e`.
// (Vitest unit tests live under src/ and are run separately via `npm test`.)
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  // One worker: the suite shares a single database (and the login limiter has a
  // min-gap), so tests must not run concurrently against the same data.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Boots the app for the test run; reuses an already-running dev server locally.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
