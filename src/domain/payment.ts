import type { PaymentConfiguration } from "../config";

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

export function createPayPalMeUrl(
  configuration: PaymentConfiguration,
  amountMinor: number,
): URL | undefined {
  if (!configuration.profile || !isValidAmount(amountMinor)) {
    return undefined;
  }

  const amount = (amountMinor / 100).toFixed(2);
  return new URL(`https://paypal.me/${configuration.profile}/${amount}GBP`);
}
