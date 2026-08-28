import { readFile } from "node:fs/promises";
import { parsePriceDataset } from "../src/domain/pricing.ts";

const horizonArgument = process.argv.find((argument) =>
  argument.startsWith("--horizon-days="),
);
const horizonDays = horizonArgument
  ? Number(horizonArgument.slice("--horizon-days=".length))
  : 0;

if (!Number.isSafeInteger(horizonDays) || horizonDays < 0) {
  console.error("Price validation horizon must be a non-negative integer.");
  process.exitCode = 1;
} else {
  const referenceDate = new Date();
  referenceDate.setUTCDate(referenceDate.getUTCDate() + horizonDays);

  const datasetUrl = new URL(
    "../src/data/uk-beer-prices.json",
    import.meta.url,
  );
  const dataset = JSON.parse(await readFile(datasetUrl, "utf8"));

  try {
    parsePriceDataset(dataset, referenceDate);
    console.log(
      horizonDays === 0
        ? "Price data is valid."
        : `Price data remains valid for at least ${horizonDays} days.`,
    );
  } catch (error) {
    console.error(
      horizonDays === 0
        ? "Price data validation failed."
        : `Price data expires within ${horizonDays} days.`,
    );
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
