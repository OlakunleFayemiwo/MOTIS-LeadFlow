import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "python3 -m http.server 4173 --directory public",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "mobile-320", use: { ...devices["iPhone SE"] } },
    { name: "mobile-390", use: { ...devices["iPhone 12"] } },
    { name: "mobile-430", use: { ...devices["Pixel 7"] } },
    { name: "tablet-768", use: { ...devices["iPad Mini"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
