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
const identifierPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const allowedKinds = new Set(["country", "region", "city"]);
const maximumObservationAgeMonths = 18;

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmptyString);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function observationDateError(
  value: unknown,
  referenceDate: Date,
): "invalid" | "future" | "stale" | undefined {
  if (!validDate(value)) {
    return "invalid";
  }

  const observed = new Date(`${value}T00:00:00Z`);
  const reference = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );
  const oldestAccepted = new Date(reference);
  oldestAccepted.setUTCMonth(
    oldestAccepted.getUTCMonth() - maximumObservationAgeMonths,
  );

  if (observed > reference) {
    return "future";
  }
  if (observed < oldestAccepted) {
    return "stale";
  }
  return undefined;
}

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

export function validatePriceDataset(
  input: unknown,
  referenceDate: Date = new Date(),
): string[] {
  const errors: string[] = [];
  const dataset = asRecord(input);
  if (!dataset) {
    return ["Price data must be an object."];
  }

  if (dataset.schemaVersion !== "1.0") {
    errors.push("Unsupported price data schema version.");
  }
  if (!nonEmptyString(dataset.datasetVersion)) {
    errors.push("Dataset version is required.");
  }
  if (!validDate(dataset.reviewedAt)) {
    errors.push("Dataset review date is invalid.");
  } else if (
    new Date(`${dataset.reviewedAt}T00:00:00Z`) >
    new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
      ),
    )
  ) {
    errors.push("Dataset review date cannot be in the future.");
  }
  if (
    !Array.isArray(dataset.supportedCountries) ||
    dataset.supportedCountries.length !== 1 ||
    dataset.supportedCountries[0] !== "GB"
  ) {
    errors.push("Supported countries must contain only GB.");
  }
  if (!nonEmptyString(dataset.nationalBenchmarkZoneId)) {
    errors.push("National benchmark zone ID is required.");
  }

  const rawSources = Array.isArray(dataset.sources) ? dataset.sources : [];
  const rawZones = Array.isArray(dataset.zones) ? dataset.zones : [];
  if (!Array.isArray(dataset.sources)) {
    errors.push("Price sources must be an array.");
  }
  if (!Array.isArray(dataset.zones)) {
    errors.push("Price zones must be an array.");
  }

  const sourceIds = new Set<string>();
  const referencedSourceIds = new Set<string>();
  for (const [index, rawSource] of rawSources.entries()) {
    const source = asRecord(rawSource);
    if (!source) {
      errors.push(`Source at index ${index} must be an object.`);
      continue;
    }

    const id = nonEmptyString(source.id) ? source.id : `index-${index}`;
    if (!identifierPattern.test(id)) {
      errors.push(`Source "${id}" has an invalid ID.`);
    }
    if (sourceIds.has(id)) {
      errors.push(`Duplicate source ID "${id}".`);
    }
    sourceIds.add(id);

    for (const field of ["publisher", "title", "methodologyNote"] as const) {
      if (!nonEmptyString(source[field])) {
        errors.push(`Source "${id}" has an invalid ${field}.`);
      }
    }
    for (const field of ["publishedAt", "accessedAt"] as const) {
      if (!validDate(source[field])) {
        errors.push(`Source "${id}" has an invalid ${field}.`);
      }
    }

    if (!nonEmptyString(source.url)) {
      errors.push(`Source "${id}" has an invalid URL.`);
    } else {
      try {
        const sourceUrl = new URL(source.url);
        if (sourceUrl.protocol !== "https:") {
          errors.push(`Source "${id}" URL must use HTTPS.`);
        }
      } catch (error) {
        if (error instanceof TypeError) {
          errors.push(`Source "${id}" has an invalid URL.`);
        } else {
          throw error;
        }
      }
    }
  }

  const zoneRecords = new Map<string, UnknownRecord>();
  const aliasOwners = new Map<string, string>();
  for (const [index, rawZone] of rawZones.entries()) {
    const zone = asRecord(rawZone);
    if (!zone) {
      errors.push(`Price zone at index ${index} must be an object.`);
      continue;
    }

    const id = nonEmptyString(zone.id) ? zone.id : `index-${index}`;
    if (!identifierPattern.test(id)) {
      errors.push(`Price zone "${id}" has an invalid ID.`);
    }
    if (zoneRecords.has(id)) {
      errors.push(`Duplicate price zone ID "${id}".`);
    }
    zoneRecords.set(id, zone);

    if (zone.countryCode !== "GB") {
      errors.push(`Price zone "${id}" must use country GB.`);
    }
    if (!allowedKinds.has(String(zone.kind))) {
      errors.push(`Price zone "${id}" has an invalid kind.`);
    }
    if (!nonEmptyString(zone.label)) {
      errors.push(`Price zone "${id}" has an invalid label.`);
    }
    if (
      !Number.isSafeInteger(zone.amountMinor) ||
      Number(zone.amountMinor) <= 0
    ) {
      errors.push(`Price zone "${id}" has an invalid amount.`);
    }
    if (zone.currency !== "GBP") {
      errors.push(`Price zone "${id}" must use currency GBP.`);
    }

    const dateError = observationDateError(zone.observedAt, referenceDate);
    if (dateError) {
      errors.push(`Price zone "${id}" observation date is ${dateError}.`);
    }

    if (!stringArray(zone.sourceIds) || zone.sourceIds.length === 0) {
      errors.push(`Price zone "${id}" must reference at least one source.`);
    } else {
      const uniqueZoneSources = new Set(zone.sourceIds);
      if (uniqueZoneSources.size !== zone.sourceIds.length) {
        errors.push(`Price zone "${id}" has duplicate source references.`);
      }
      for (const sourceId of uniqueZoneSources) {
        referencedSourceIds.add(sourceId);
      }
    }

    if (!stringArray(zone.aliases)) {
      errors.push(`Price zone "${id}" aliases must be non-empty strings.`);
    } else if (
      nonEmptyString(zone.label) &&
      allowedKinds.has(String(zone.kind))
    ) {
      for (const alias of [zone.label, ...zone.aliases]) {
        const normalizedAlias = normalizeLocationName(alias);
        const aliasKey = `${String(zone.kind)}:${normalizedAlias}`;
        const owner = aliasOwners.get(aliasKey);
        if (owner && owner !== id) {
          errors.push(
            `Price zones "${owner}" and "${id}" share ambiguous ${String(zone.kind)} alias "${alias}".`,
          );
        } else {
          aliasOwners.set(aliasKey, id);
        }
      }
    }
  }

  for (const [id, zone] of zoneRecords) {
    if (stringArray(zone.sourceIds)) {
      for (const sourceId of zone.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          errors.push(
            `Price zone "${id}" references missing source "${sourceId}".`,
          );
        }
      }
    }

    if (zone.kind === "city") {
      const parent = nonEmptyString(zone.parentRegionId)
        ? zoneRecords.get(zone.parentRegionId)
        : undefined;
      if (!parent || parent.kind !== "region") {
        errors.push(`City "${id}" has no valid parent region.`);
      }
    } else if (zone.parentRegionId !== undefined) {
      errors.push(`Non-city price zone "${id}" cannot have a parent region.`);
    }
  }

  if (nonEmptyString(dataset.nationalBenchmarkZoneId)) {
    const national = zoneRecords.get(dataset.nationalBenchmarkZoneId);
    if (!national || national.kind !== "country") {
      errors.push("National price benchmark must reference a country zone.");
    }
  }
  for (const regionId of requiredRegionIds) {
    const region = zoneRecords.get(regionId);
    if (!region || region.kind !== "region") {
      errors.push(`Required regional fallback "${regionId}" is missing.`);
    }
  }
  for (const sourceId of sourceIds) {
    if (!referencedSourceIds.has(sourceId)) {
      errors.push(`Source "${sourceId}" is not referenced by a price zone.`);
    }
  }

  return errors;
}

export function parsePriceDataset(
  input: unknown,
  referenceDate: Date = new Date(),
): PriceDataset {
  const errors = validatePriceDataset(input, referenceDate);
  if (errors.length > 0) {
    throw new Error(`Price data cannot be used: ${errors.join(" ")}`);
  }
  return input as PriceDataset;
}
