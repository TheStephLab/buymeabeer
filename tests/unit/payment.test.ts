import { validatePaymentProfile } from "../../src/config";
import {
  createPayPalMeUrl,
  formatPounds,
  isValidAmount,
} from "../../src/domain/payment";

describe("payment links", () => {
  it("formats and carries exact penny amounts to PayPal.Me", () => {
    const configuration = validatePaymentProfile("Beer-Friend.1");

    expect(formatPounds(648)).toBe("£6.48");
    expect(createPayPalMeUrl(configuration, 648)?.toString()).toBe(
      "https://paypal.me/Beer-Friend.1/6.48GBP",
    );
  });

  it("rejects missing, placeholder, malformed, and non-positive settings", () => {
    expect(validatePaymentProfile(undefined).profile).toBeUndefined();
    expect(
      validatePaymentProfile("your-paypal-me-username").profile,
    ).toBeUndefined();
    expect(validatePaymentProfile("../not-a-profile").profile).toBeUndefined();
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(648.5)).toBe(false);
    expect(
      createPayPalMeUrl(validatePaymentProfile("beerfriend"), -1),
    ).toBeUndefined();
  });
});
