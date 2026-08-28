import { readFile, writeFile } from "node:fs/promises";

const datasetPath = new URL("../src/data/uk-beer-prices.json", import.meta.url);
const sourceUrl =
  "https://www.ons.gov.uk/generator?format=csv&uri=/economy/inflationandpriceindices/timeseries/czms/mm23";

function valueFor(label, csv) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = csv.match(new RegExp(`^"${escapedLabel}","([^"]*)"$`, "m"));
  return match?.[1];
}

const response = await fetch(sourceUrl);
if (!response.ok) {
  throw new Error(`ONS download failed with HTTP ${response.status}.`);
}

const csv = await response.text();
const observations = [
  ...csv.matchAll(
    /^"(\d{4} (?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))","(\d+)"$/gm,
  ),
];
const latest = observations.at(-1);
const releaseDate = valueFor("Release date", csv);

if (!latest || !releaseDate) {
  throw new Error(
    "The ONS CSV did not contain a usable monthly price or release date.",
  );
}

const amountMinor = Number(latest[2]);
if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
  throw new Error(
    `The ONS price "${latest[2]}" is not a positive integer number of pence.`,
  );
}

const monthIndex = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
].indexOf(latest[1].slice(-3));
const observedAt = `${latest[1].slice(0, 4)}-${String(monthIndex + 1).padStart(2, "0")}-01`;
const publishedAt = releaseDate.split("-").reverse().join("-");
const dataset = JSON.parse(await readFile(datasetPath, "utf8"));
const national = dataset.zones.find(
  (zone) => zone.id === dataset.nationalBenchmarkZoneId,
);
const source = dataset.sources.find((entry) => entry.id === "ons-czms");

if (!national || !source) {
  throw new Error("The national benchmark or its ONS source entry is missing.");
}

national.amountMinor = amountMinor;
national.observedAt = observedAt;
source.publishedAt = publishedAt;
source.accessedAt = new Date().toISOString().slice(0, 10);
source.methodologyNote = `Latest usable monthly observation in this ONS series: ${latest[1]}, ${amountMinor} pence.`;

await writeFile(datasetPath, `${JSON.stringify(dataset, null, 2)}\n`);
console.log(
  `Updated UK national benchmark to ${amountMinor}p from ${latest[1]}.`,
);
