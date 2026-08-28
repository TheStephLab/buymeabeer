export interface PaymentConfiguration {
  profile?: string;
  error?: string;
}

const profilePattern = /^[A-Za-z0-9.-]{3,80}$/;
const placeholders = new Set([
  "your-paypal-me-username",
  "example",
  "username",
  "changeme",
]);

export function validatePaymentProfile(
  value: string | undefined,
): PaymentConfiguration {
  const profile = value?.trim();

  if (!profile || placeholders.has(profile.toLowerCase())) {
    return { error: "The PayPal.Me profile has not been configured." };
  }

  if (!profilePattern.test(profile)) {
    return { error: "The PayPal.Me profile is not valid." };
  }

  return { profile };
}

export const paymentConfiguration = validatePaymentProfile(
  import.meta.env.VITE_PAYPAL_ME_USERNAME,
);
