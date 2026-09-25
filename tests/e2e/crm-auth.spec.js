import { test, expect } from "@playwright/test";

test.use({ trace: "off", screenshot: "off", video: "off" });

test("production CRM login establishes a session and logout clears it", async ({ page }) => {
  test.skip(!process.env.E2E_CRM_PASSWORD, "Production CRM credentials are not configured for this run.");
  await page.goto("/admin/");
  await expect(page.locator("#loginSection")).toBeVisible();
  const loginResponsePromise = page.waitForResponse((response) => response.url().includes("/.netlify/functions/crmLogin") && response.request().method() === "POST");
  await page.locator("#passwordInput").fill(process.env.E2E_CRM_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  const leadsResponsePromise = page.waitForResponse((response) => response.url().includes("/.netlify/functions/getLeads") && response.request().method() === "GET");
  await expect(page.locator("#dashboardSection")).toBeVisible();
  const leadsResponse = await leadsResponsePromise;
  expect(leadsResponse.status()).toBe(200);
  await expect(page.locator("#loginSection")).toBeHidden();
  await expect(page.locator("#logoutBtn")).toBeVisible();
  await expect(page.locator("#roleBtn-admin")).toBeVisible();
  await expect(page.locator("#roleBtn-sales")).toBeVisible();
  await expect(page.locator("#roleBtn-production")).toBeVisible();
  const logoutResponsePromise = page.waitForResponse((response) => response.url().includes("/.netlify/functions/crmLogout") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Log Out" }).click();
  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.status()).toBe(200);
  await expect(page.locator("#loginSection")).toBeVisible();
  await expect(page.locator("#dashboardSection")).toBeHidden();
});