import { validatePayPalMeProfile } from "../src/domain/payment.ts";

const validation = validatePayPalMeProfile(process.env.VITE_PAYPAL_ME_USERNAME);

if (!validation.profile) {
  console.error(validation.error);
  process.exitCode = 1;
} else {
  console.log("Payment configuration is valid.");
}
