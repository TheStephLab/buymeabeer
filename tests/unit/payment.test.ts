import {
  createPayPalMeProvider,
  createPayPalMeUrl,
  formatPounds,
  isValidAmount,
  validatePayPalMeProfile,
} from "../../src/domain/payment";

describe("payment links", () => {
  it("formats and carries exact penny amounts to PayPal.Me", () => {
    const validation = validatePayPalMeProfile("Beer-Friend.1");

    expect(formatPounds(648)).toBe("£6.48");
    expect(createPayPalMeUrl(validation.profile, 648)?.toString()).toBe(
      "https://paypal.me/Beer-Friend.1/6.48GBP",
    );
  });

  it("rejects missing, placeholder, malformed, and non-positive settings", () => {
    expect(validatePayPalMeProfile(undefined).profile).toBeUndefined();
    expect(
      validatePayPalMeProfile("your-paypal-me-username").profile,
    ).toBeUndefined();
    expect(validatePayPalMeProfile("../not-a-profile").profile).toBeUndefined();
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(648.5)).toBe(false);
    expect(createPayPalMeUrl("beerfriend", -1)).toBeUndefined();
  });

  it("exposes provider-neutral checkout metadata", () => {
    const provider = createPayPalMeProvider("beerfriend");

    expect(provider.displayName).toBe("PayPal");
    expect(provider.configurationError).toBeUndefined();
    expect(provider.createPaymentUrl(478)?.pathname).toBe(
      "/beerfriend/4.78GBP",
    );
  });
});
