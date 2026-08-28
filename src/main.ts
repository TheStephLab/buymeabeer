import "@fontsource/alegreya-sans/latin-400.css";
import "@fontsource/alegreya-sans/latin-700.css";
import "@fontsource-variable/fraunces";
import datasetJson from "./data/uk-beer-prices.json";
import { validatePriceDataset } from "./domain/pricing";
import "./styles.css";
import type { PriceDataset } from "./types";
import { createApp } from "./ui/app";

const dataset = datasetJson as PriceDataset;
const errors = validatePriceDataset(dataset);

if (errors.length > 0) {
  throw new Error(`Price data cannot be used: ${errors.join(" ")}`);
}

const root = document.querySelector<HTMLElement>("#app");
if (!root) {
  throw new Error("The app root is missing.");
}

createApp(root, dataset);
