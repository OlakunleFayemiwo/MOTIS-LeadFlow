import { test, expect } from "@playwright/test";

const publicPages = [
  { path: "/", heading: /Where .*Perfection/i },
  { path: "/more-paint.html", heading: /More Paint/i },
];

for (const pageInfo of publicPages) {
  test(`public page loads without horizontal overflow: ${pageInfo.path}`, async ({ page }) => {
    await page.goto(pageInfo.path);
    await expect(page).toHaveTitle(/Motis Industries|More Paint/i);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).toContainText(pageInfo.heading);

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(overflow).toBe(false);
  });
}

test("homepage has usable primary quote actions on mobile", async ({ page }) => {
  await page.goto("/");
  const quoteLinks = page.getByRole("link", { name: "Request a Quote" });
  await expect(quoteLinks.first()).toBeVisible();

  const box = await quoteLinks.first().boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(40);
});

test("homepage quote form is reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Request a Quote" }).first().click();
  await expect(page.locator("#quote")).toBeInViewport();
});

test("More Paint keeps the AI assistant action available", async ({ page }) => {
  await page.goto("/more-paint.html");
  await expect(page.getByRole("button", { name: /Ask our AI Assistant/i }).first()).toBeVisible();
});

test("CRM presents a usable sign-in screen", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#loginSection")).toBeVisible();
  await expect(page.locator("#passwordInput")).toBeVisible();

  const passwordBox = await page.locator("#passwordInput").boundingBox();
  expect(passwordBox).not.toBeNull();
  expect(passwordBox.width).toBeGreaterThanOrEqual(200);
  expect(passwordBox.height).toBeGreaterThanOrEqual(40);
});

test("More Paint WhatsApp CTA stays on the WhatsApp path when no direct number is configured", async ({ page }) => {
  await page.route("**/.netlify/functions/aiQuoteAssistant", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        reply: "Illustrative estimate for testing the WhatsApp action.",
      }),
    });
  });

  await page.goto("/more-paint.html");
  await page.locator("#chatInput").fill("Test building project");
  await page.locator("#chatForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#chatHistory")).toContainText("Illustrative estimate for testing the WhatsApp action.");

  const cta = page.getByRole("button", {
    name: /Send Estimate to WhatsApp & Request Quote/i,
  });
  await expect(cta).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await cta.click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded").catch(() => {});
  expect(popup.url()).toMatch(/^https:\/\/wa\.me\/\?text=/);
  await popup.close();
});

test("CRM mobile navigation controls are present", async ({ page }) => {
  await page.goto("/admin/");
  for (const id of ["roleBtn-admin", "roleBtn-sales", "roleBtn-production"]) {
    const button = page.locator(`#${id}`);
    await expect(button).toBeAttached();
    expect(await button.evaluate((el) => el.tagName)).toBe("BUTTON");
  }
});

test("CRM mobile card containers exist and desktop tables remain present", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#salesMobileList")).toBeAttached();
  await expect(page.locator("#productionMobileList")).toBeAttached();
  await expect(page.locator("#salesDesktopTable")).toBeAttached();
  await expect(page.locator("#productionDesktopTable")).toBeAttached();
});



test("public mobile footer keeps all navigation links usable", async ({ page }) => {
  await page.goto("/");
  const footerNav = page.locator("footer .footer-nav");
  await expect(footerNav).toBeVisible();

  const links = footerNav.getByRole("link");
  await expect(links).toHaveCount(4);

  for (let i = 0; i < 4; i += 1) {
    const box = await links.nth(i).boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  const quoteLink = footerNav.getByRole("link", { name: "Request a Quote" });
  await expect(quoteLink).toBeVisible();
});

test("CRM mobile department navigation has a visible three-button layout", async ({ page }) => {
  await page.goto("/admin/");

  const result = await page.evaluate(() => {
    const dashboard = document.querySelector("#dashboardSection");
    const aside = dashboard?.querySelector("aside");
    const nav = aside?.querySelector("nav");
    if (!dashboard || !aside || !nav) return null;

    dashboard.classList.remove("hidden-section");
    const buttons = [...nav.querySelectorAll("button")];
    const navStyle = getComputedStyle(nav);
    const widths = buttons.map((button) => button.getBoundingClientRect().width);

    return {
      gridColumns: navStyle.gridTemplateColumns,
      overflowX: navStyle.overflowX,
      buttonCount: buttons.length,
      widths,
      viewportWidth: window.innerWidth,
    };
  });

  expect(result).not.toBeNull();
  expect(result.buttonCount).toBe(3);

  if (result.viewportWidth < 768) {
    expect(result.gridColumns.split(" ").length).toBe(3);
    expect(result.overflowX).toBe("visible");
    expect(result.widths.every((width) => width >= 44)).toBe(true);
  }
});

test("CRM lead and fulfillment modals are present for interactive flows", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#leadModal")).toBeAttached();
  await expect(page.locator("#workslipModal")).toBeAttached();
  await expect(page.locator("#generateCoPilotBtn")).toBeAttached();
  await expect(page.locator("#copyDraftBtn")).toBeAttached();
});
