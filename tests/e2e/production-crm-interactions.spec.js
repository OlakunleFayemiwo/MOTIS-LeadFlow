import { test, expect } from "@playwright/test";

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function signIn(page) {
  test.skip(
    !process.env.E2E_CRM_PASSWORD,
    "Production CRM credentials are not configured for this run.",
  );

  await page.goto("/admin/");
  await expect(page.locator("#loginSection")).toBeVisible();

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/crmLogin") &&
      response.request().method() === "POST",
  );

  await page.locator("#passwordInput").fill(process.env.E2E_CRM_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);

  const leadsResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/getLeads") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );

  await expect(page.locator("#dashboardSection")).toBeVisible();
  await expect(page.locator("#loginSection")).toBeHidden();
  await leadsResponsePromise;
}

test("production CRM harmless navigation and refresh interactions work", async ({
  page,
}) => {
  await signIn(page);

  await expect(page.locator("#view-admin")).toBeVisible();

  await page.getByRole("button", { name: /Sales & CRM/i }).click();
  await expect(page.locator("#view-sales")).toBeVisible();

  const refreshResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/getLeads") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: /^Refresh$/ }).click();
  await refreshResponsePromise;
  await expect(page.locator("#view-sales")).toBeVisible();

  await page.getByRole("button", { name: /Fulfillment Review/i }).click();
  await expect(page.locator("#view-production")).toBeVisible();

  const refreshFulfillmentResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/getLeads") &&
      response.request().method() === "GET" &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "Refresh Leads" }).click();
  await refreshFulfillmentResponsePromise;
  await expect(page.locator("#view-production")).toBeVisible();

  await page.getByRole("button", { name: /Lead Analytics/i }).click();
  await expect(page.locator("#view-admin")).toBeVisible();
});

test("production CRM CSV export produces a download without changing data", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("button", { name: /Sales & CRM/i }).click();
  await expect(page.locator("#view-sales")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^motis-crm-leads-\d{4}-\d{2}-\d{2}\.csv$/);
});

test("production CRM lead detail modal opens and closes without saving changes", async ({
  page,
}) => {
  await signIn(page);

  await page.getByRole("button", { name: /Sales & CRM/i }).click();
  await expect(page.locator("#view-sales")).toBeVisible();

  const viewLeadButtons = page.getByRole("button", { name: "View Lead" });
  const count = await viewLeadButtons.count();

  if (count === 0) {
    await expect(page.locator("#salesEmptyState")).toBeVisible();
    return;
  }

  await viewLeadButtons.first().click();
  await expect(page.locator("#leadModal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lead Details" })).toBeVisible();

  const saveStatusButton = page.locator("#saveStatusBtn");
  await expect(saveStatusButton).toBeVisible();

  await page.locator("#leadModal button").first().click();
  await expect(page.locator("#leadModal")).toBeHidden();
});

test("production CRM logout clears the authenticated dashboard", async ({
  page,
}) => {
  await signIn(page);

  const logoutResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/crmLogout") &&
      response.request().method() === "POST",
  );

  await page.getByRole("button", { name: "Log Out" }).click();

  const logoutResponse = await logoutResponsePromise;
  expect(logoutResponse.status()).toBe(200);

  await expect(page.locator("#loginSection")).toBeVisible();
  await expect(page.locator("#dashboardSection")).toBeHidden();
  await expect(page.locator("#logoutBtn")).toBeHidden();

  const protectedResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/getLeads") &&
      response.request().method() === "GET",
  );

  await page.reload();

  const protectedResponse = await protectedResponsePromise;
  expect(protectedResponse.status()).toBe(401);
  await expect(page.locator("#loginSection")).toBeVisible();
  await expect(page.locator("#dashboardSection")).toBeHidden();
});
