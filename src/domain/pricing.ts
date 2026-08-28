import type {
  LocationCandidate,
  PriceDataset,
  PriceZone,
  ResolvedPrice,
} from "../types";

const requiredRegionIds = [
  "gb-london",
  "gb-scotland",
  "gb-wales",
  "gb-northern-ireland",
  "gb-north-east",
  "gb-north-west",
  "gb-yorkshire-humber",
  "gb-east-midlands",
  "gb-west-midlands",
  "gb-east-of-england",
  "gb-south-east",
  "gb-south-west",
];

export function normalizeLocationName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLocaleLowerCase("en-GB");
}

function matchesCandidate(zone: PriceZone, candidates: string[]): boolean {
  const aliases = [zone.label, ...zone.aliases].map(normalizeLocationName);
  return candidates.some((candidate) =>
    aliases.includes(normalizeLocationName(candidate)),
  );
}

function findZone(
  zones: PriceZone[],
  kind: PriceZone["kind"],
  candidates: string[],
): PriceZone | undefined {
  return zones.find(
    (zone) => zone.kind === kind && matchesCandidate(zone, candidates),
  );
}

export function resolvePrice(
  location: Pick<
    LocationCandidate,
    "countryCode" | "cityCandidates" | "regionCandidates"
  >,
  dataset: PriceDataset,
): ResolvedPrice | undefined {
  if (location.countryCode.trim().toUpperCase() !== "GB") {
    return undefined;
  }

  const city = findZone(dataset.zones, "city", location.cityCandidates);
  if (city) {
    return { zone: city, level: "city", source: "browser", approximate: false };
  }

  const region = findZone(dataset.zones, "region", location.regionCandidates);
  if (region) {
    return {
      zone: region,
      level: "region",
      source: "browser",
      approximate: false,
    };
  }

  const national = dataset.zones.find(
    (zone) => zone.id === dataset.nationalBenchmarkZoneId,
  );
  return national
    ? {
        zone: national,
        level: "national",
        source: "browser",
        approximate: false,
      }
    : undefined;
}

function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  );
}

export function validatePriceDataset(dataset: PriceDataset): string[] {
  const errors: string[] = [];
  const zoneIds = new Set<string>();
  const sourceIds = new Set(dataset.sources.map((source) => source.id));
  const referencedSourceIds = new Set<string>();

  if (dataset.schemaVersion !== "1.0") {
    errors.push("Unsupported price data schema version.");
  }

  if (!dataset.supportedCountries.includes("GB")) {
    errors.push("UK support is required.");
  }

  for (const source of dataset.sources) {
    if (
      !source.id ||
      !source.publisher ||
      !source.title ||
      !validDate(source.publishedAt)
    ) {
      errors.push(`Source "${source.id || "unknown"}" is incomplete.`);
    }
    try {
      new URL(source.url);
    } catch (error) {
      if (error instanceof TypeError) {
        errors.push(`Source "${source.id || "unknown"}" has an invalid URL.`);
      } else {
        throw error;
      }
    }
  }

  for (const zone of dataset.zones) {
    if (zoneIds.has(zone.id)) {
      errors.push(`Duplicate price zone ID "${zone.id}".`);
    }
    zoneIds.add(zone.id);

    if (
      zone.countryCode !== "GB" ||
      zone.currency !== "GBP" ||
      !Number.isSafeInteger(zone.amountMinor) ||
      zone.amountMinor <= 0 ||
      !validDate(zone.observedAt)
    ) {
      errors.push(`Price zone "${zone.id}" is malformed.`);
    }

    for (const sourceId of zone.sourceIds) {
      referencedSourceIds.add(sourceId);
      if (!sourceIds.has(sourceId)) {
        errors.push(
          `Price zone "${zone.id}" references missing source "${sourceId}".`,
        );
      }
    }
  }

  for (const zone of dataset.zones.filter((entry) => entry.kind === "city")) {
    if (!zone.parentRegionId || !zoneIds.has(zone.parentRegionId)) {
      errors.push(`City "${zone.id}" has no valid parent region.`);
    }
  }

  if (!zoneIds.has(dataset.nationalBenchmarkZoneId)) {
    errors.push("National price benchmark is missing.");
  }

  for (const regionId of requiredRegionIds) {
    if (!zoneIds.has(regionId)) {
      errors.push(`Required regional fallback "${regionId}" is missing.`);
    }
  }

  for (const source of dataset.sources) {
    if (!referencedSourceIds.has(source.id)) {
      errors.push(`Source "${source.id}" is not referenced by a price zone.`);
    }
  }

  return errors;
}
