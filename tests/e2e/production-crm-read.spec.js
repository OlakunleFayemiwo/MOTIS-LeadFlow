import { test, expect } from "@playwright/test";

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
});

async function signInAndLoadLeads(page) {
  test.skip(
    !process.env.E2E_CRM_PASSWORD,
    "Production CRM credentials are not configured for this run.",
  );

  await page.goto("/admin/");
  await expect(page.locator("#loginSection")).toBeVisible();

  const leadsResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/.netlify/functions/getLeads") &&
      response.request().method() === "GET",
  );

  await page.locator("#passwordInput").fill(process.env.E2E_CRM_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();

  const leadsResponse = await leadsResponsePromise;
  expect(leadsResponse.status()).toBe(200);

  const payload = await leadsResponse.json();
  expect(payload.success).toBe(true);
  expect(Array.isArray(payload.leads)).toBe(true);

  await expect(page.locator("#dashboardSection")).toBeVisible();
  await expect(page.locator("#loginSection")).toBeHidden();

  return payload.leads;
}

test("production CRM read flow renders analytics, sales, and lead details", async ({
  page,
}) => {
  const leads = await signInAndLoadLeads(page);

  await expect(page.locator("#view-admin")).toBeVisible();
  expect(Number.isInteger(leads.length)).toBe(true);
  await expect(page.locator("#stat-totalLeads")).toHaveText(String(leads.length));

  await page.getByRole("button", { name: /Sales & CRM/i }).click();
  await expect(page.locator("#view-sales")).toBeVisible();

  const isMobile = (await page.evaluate(() => window.innerWidth)) < 768;

  if (isMobile) {
    await expect(page.locator("#salesMobileList")).toBeVisible();
  } else {
    await expect(page.locator("#salesDesktopTable")).toBeVisible();
  }

  if (leads.length === 0) {
    await expect(page.locator("#salesEmptyState")).toBeVisible();
    return;
  }

  if (isMobile) {
    const cards = page.locator("#salesMobileList .crm-mobile-card");
    await expect(cards).toHaveCount(leads.length);
    await cards.first().getByRole("button", { name: "View Lead" }).click();
  } else {
    const rows = page.locator("#salesTableBody tr");
    await expect(rows).toHaveCount(leads.length);
    await rows.first().getByRole("button", { name: "View Lead" }).click();
  }

  await expect(page.locator("#leadModal")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lead Details" })).toBeVisible();
  await expect(page.locator("#modal-name")).toBeVisible();
  await expect(page.locator("#modal-location")).toBeVisible();
  await expect(page.locator("#modal-productLine")).toBeVisible();
  await expect(page.locator("#modal-statusSelect")).toBeVisible();
});

test("production CRM fulfillment review renders won leads without changing data", async ({
  page,
}) => {
  const leads = await signInAndLoadLeads(page);
  const wonLeads = leads.filter((lead) => lead.status === "won");

  await page.getByRole("button", { name: /Fulfillment Review/i }).click();
  await expect(page.locator("#view-production")).toBeVisible();

  const isMobile = (await page.evaluate(() => window.innerWidth)) < 768;

  if (isMobile) {
    await expect(page.locator("#productionMobileList")).toBeVisible();
  } else {
    await expect(page.locator("#productionDesktopTable")).toBeVisible();
  }

  if (wonLeads.length === 0) {
    await expect(page.locator("#productionEmptyState")).toBeVisible();
    return;
  }

  if (isMobile) {
    const cards = page.locator("#productionMobileList .crm-mobile-card");
    await expect(cards).toHaveCount(wonLeads.length);
    await cards.first().getByRole("button", { name: "Review Summary" }).click();
  } else {
    const rows = page.locator("#productionTableBody tr");
    await expect(rows).toHaveCount(wonLeads.length);
    await rows.first().getByRole("button", { name: "Review Summary" }).click();
  }

  await expect(page.locator("#workslipModal")).toBeVisible();
  await expect(
    page.getByText("Sales Outcome — Not a Production Order"),
  ).toBeVisible();
  await expect(page.locator("#fulfillmentNotice")).toContainText(
    "does not authorize manufacturing",
  );
});
