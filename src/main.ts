import "@fontsource/alegreya-sans/latin-400.css";
import "@fontsource/alegreya-sans/latin-700.css";
import "@fontsource-variable/fraunces";
import { paymentProvider } from "./config";
import datasetJson from "./data/uk-beer-prices.json";
import { parsePriceDataset } from "./domain/pricing";
import "./styles.css";
import { createApp } from "./ui/app";

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("The app root is missing.");
}

try {
  const dataset = parsePriceDataset(datasetJson);
  createApp(root, dataset, paymentProvider);
} catch (error) {
  console.error(error);

  const message = document.createElement("section");
  message.id = "beer-card";
  message.className = "system-message";
  message.setAttribute("role", "alert");

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "BUY ME A BEER";

  const heading = document.createElement("h1");
  heading.textContent = "Prices need a refresh.";

  const copy = document.createElement("p");
  copy.textContent =
    "The current pricing data could not be safely verified, so payments are temporarily unavailable. Please check back soon.";

  message.append(eyebrow, heading, copy);
  root.replaceChildren(message);
}
