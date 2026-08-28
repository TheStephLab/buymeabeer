import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("starts private and creates an exact manual payment link", async ({
  page,
}) => {
  let geocodingRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("reverse-geocode-client")) {
      geocodingRequests += 1;
    }
  });

  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Choose a location to buy a beer" }),
  ).toHaveAttribute("aria-disabled", "true");
  expect(geocodingRequests).toBe(0);

  await page.locator("#manual-location").selectOption("gb-manchester");
  await expect(page.getByText("Average in Manchester")).toBeVisible();
  await expect(page.getByText("£4.78", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Buy me a beer for £4.78" }),
  ).toHaveAttribute("href", "https://paypal.me/beerfriend/4.78GBP");
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

  await page.goto("/");
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
  await page.goto("/");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
