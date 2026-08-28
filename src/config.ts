import { createPayPalMeProvider } from "./domain/payment";

export const paymentProvider = createPayPalMeProvider(
  import.meta.env.VITE_PAYPAL_ME_USERNAME,
);
