import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const londonFixture = {
  countryCode: "GB",
  city: "London",
  locality: "City of Westminster",
  principalSubdivision: "England",
  localityInfo: {
    administrative: [{ name: "England" }, { name: "London" }],
  },
};

function pounds(amountMinor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountMinor / 100);
}

async function denyBrowserLocation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(
          _success: PositionCallback,
          error?: PositionErrorCallback,
        ) {
          error?.({
            code: 1,
            message: "Permission denied by test",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          });
        },
      },
    });
  });
}

test("shows a safe unavailable state instead of using stale prices", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2027-12-01T12:00:00Z") });
  await page.goto("./");

  await expect(page.getByRole("alert")).toContainText("Prices need a refresh.");
  await expect(
    page.getByRole("link", { name: /Buy me a beer for/ }),
  ).toHaveCount(0);
});

test("starts private and creates an exact manual payment link", async ({
  page,
}) => {
  let geocodingRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("reverse-geocode-client")) {
      geocodingRequests += 1;
    }
  });

  await page.goto("./");

  await expect(page.locator('script[type="module"]')).toHaveAttribute(
    "src",
    /\/buymeabeer\/assets\/index-/,
  );
  await expect(
    page.getByRole("button", { name: "Choose a location to buy a beer" }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(geocodingRequests).toBe(0);

  const amount = pounds(572);
  await page.locator("#manual-location").selectOption("gb-manchester");
  await expect(page.getByText("Average in Manchester")).toBeVisible();
  await expect(page.getByText(amount, { exact: true })).toBeVisible();

  const href = await page
    .getByRole("button", { name: `Buy me a beer for ${amount}` })
    .getAttribute("href");
  expect(href).toBeTruthy();
  const paymentUrl = new URL(href!);
  expect(paymentUrl.origin).toBe("https://paypal.me");
  expect(paymentUrl.pathname).toMatch(/\/5\.72GBP$/);
});

test("resolves a precise UK city only after explicit consent", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 51.5072, longitude: -0.1276 });
  await page.route("**/reverse-geocode-client?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(londonFixture),
    }),
  );

  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();

  await expect(
    page.getByText("Location shared for this estimate"),
  ).toBeVisible();
  await expect(
    page.getByText("Average in London", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(pounds(675), { exact: true })).toBeVisible();
});

test("falls back to an approximate network location after permission denial", async ({
  page,
}) => {
  await denyBrowserLocation(page);
  await page.route("**/reverse-geocode-client?**", async (route) => {
    const requestUrl = new URL(route.request().url());
    expect(requestUrl.searchParams.has("latitude")).toBe(false);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        countryCode: "GB",
        city: "Manchester",
        principalSubdivision: "England",
        localityInfo: {
          administrative: [{ name: "Greater Manchester" }],
        },
      }),
    });
  });

  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();

  await expect(
    page.getByText("Approximate location from your network"),
  ).toBeVisible();
  await expect(
    page.getByText(/Average in Manchester · approximate/),
  ).toBeVisible();
});

test("keeps manual selection usable when the provider is unavailable", async ({
  page,
}) => {
  await denyBrowserLocation(page);
  await page.route("**/reverse-geocode-client?**", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );

  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();

  await expect(
    page.getByText(
      "We could not find a location. Please choose a UK area below.",
    ),
  ).toBeVisible();
  await expect(page.locator("#manual-location")).toBeFocused();
  await page.locator("#manual-location").selectOption("gb-wales");
  await expect(page.getByText("Average in Wales")).toBeVisible();
});

test("restores and forgets a session-only selection", async ({ page }) => {
  await page.goto("./");
  await page.locator("#manual-location").selectOption("gb-leeds");
  await page.reload();

  await expect(page.getByText("Saved for this browser tab")).toBeVisible();
  await expect(page.getByText("Average in Leeds")).toBeVisible();
  await page.getByRole("button", { name: "Forget this location" }).click();

  await expect(
    page.getByText("Your location stays in your control."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a location to buy a beer" }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("disables the old payment while changing location", async ({ page }) => {
  await page.goto("./");
  await page.locator("#manual-location").selectOption("gb-manchester");
  await page.getByRole("button", { name: "Change location" }).click();

  await expect(
    page.getByRole("button", { name: "Choose a new location to continue" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(page.locator("#manual-location")).toBeFocused();

  await page.locator("#manual-location").selectOption("gb-liverpool");
  await expect(page.getByText("Average in Liverpool")).toBeVisible();
});

test("does not enable payment for an automatically detected non-UK location", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 48.8566, longitude: 2.3522 });
  await page.route("**/reverse-geocode-client?**", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        countryCode: "FR",
        city: "Paris",
        principalSubdivision: "Île-de-France",
      }),
    }),
  );

  await page.goto("./");
  await page.getByRole("button", { name: "Use my location" }).click();

  await expect(
    page.getByText("UK locations are supported in this first edition."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a location to buy a beer" }),
  ).toHaveAttribute("aria-disabled", "true");
});

test("has no detectable accessibility violations at its narrowest intended layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("./");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
