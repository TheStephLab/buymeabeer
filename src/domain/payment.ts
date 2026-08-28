export interface PaymentProfileValidation {
  profile?: string;
  error?: string;
}

export interface PaymentProvider {
  readonly id: string;
  readonly displayName: string;
  readonly configurationError?: string;
  createPaymentUrl(amountMinor: number): URL | undefined;
}

const profilePattern = /^[A-Za-z0-9.-]{3,80}$/;
const placeholders = new Set([
  "your-paypal-me-username",
  "example",
  "username",
  "changeme",
]);

export function formatPounds(amountMinor: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    currencyDisplay: "symbol",
  }).format(amountMinor / 100);
}

export function isValidAmount(amountMinor: number): boolean {
  return Number.isSafeInteger(amountMinor) && amountMinor > 0;
}

export function validatePayPalMeProfile(
  value: string | undefined,
): PaymentProfileValidation {
  const profile = value?.trim();

  if (!profile || placeholders.has(profile.toLowerCase())) {
    return { error: "The PayPal.Me profile has not been configured." };
  }

  if (!profilePattern.test(profile)) {
    return { error: "The PayPal.Me profile is not valid." };
  }

  return { profile };
}

export function createPayPalMeUrl(
  profile: string | undefined,
  amountMinor: number,
): URL | undefined {
  if (!profile || !isValidAmount(amountMinor)) {
    return undefined;
  }

  const amount = (amountMinor / 100).toFixed(2);
  return new URL(`https://paypal.me/${profile}/${amount}GBP`);
}

export function createPayPalMeProvider(
  profileValue: string | undefined,
): PaymentProvider {
  const validation = validatePayPalMeProfile(profileValue);

  return {
    id: "paypal-me",
    displayName: "PayPal",
    configurationError: validation.error,
    createPaymentUrl: (amountMinor) =>
      createPayPalMeUrl(validation.profile, amountMinor),
  };
}
