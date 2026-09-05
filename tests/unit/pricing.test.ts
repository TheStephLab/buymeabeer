import datasetJson from "../../src/data/uk-beer-prices.json";
import {
  normalizeLocationName,
  parsePriceDataset,
  resolvePrice,
  validatePriceDataset,
} from "../../src/domain/pricing";
import type { PriceDataset } from "../../src/types";

const dataset = datasetJson as PriceDataset;
const reviewDate = new Date("2026-09-05T12:00:00Z");

describe("price dataset", () => {
  it("has complete UK fallback coverage and valid source references", () => {
    expect(validatePriceDataset(dataset, reviewDate)).toEqual([]);
    expect(parsePriceDataset(dataset, reviewDate)).toBe(dataset);
  });

  it("uses a city override before a regional fallback and national benchmark", () => {
    expect(
      resolvePrice(
        {
          countryCode: "GB",
          cityCandidates: ["MANCHESTER"],
          regionCandidates: ["Greater Manchester"],
        },
        dataset,
      ),
    ).toMatchObject({
      level: "city",
      zone: { id: "gb-manchester", amountMinor: 572 },
    });

    expect(
      resolvePrice(
        {
          countryCode: "GB",
          cityCandidates: ["Unknown place"],
          regionCandidates: ["East Anglia"],
        },
        dataset,
      ),
    ).toMatchObject({
      level: "region",
      zone: { id: "gb-east-of-england", amountMinor: 456 },
    });

    expect(
      resolvePrice(
        {
          countryCode: "GB",
          cityCandidates: ["Unknown place"],
          regionCandidates: ["Unknown area"],
        },
        dataset,
      ),
    ).toMatchObject({
      level: "national",
      zone: { id: "gb-national", amountMinor: 460 },
    });
  });

  it("does not apply a UK price to unsupported countries", () => {
    expect(
      resolvePrice(
        {
          countryCode: "FR",
          cityCandidates: ["Paris"],
          regionCandidates: ["Île-de-France"],
        },
        dataset,
      ),
    ).toBeUndefined();
  });

  it("normalizes punctuation and accents in provider locality names", () => {
    expect(normalizeLocationName("  Newcastle-upon-Tyne  ")).toBe(
      "newcastle upon tyne",
    );
    expect(normalizeLocationName("Île-de-France")).toBe("ile de france");
  });

  it("reports malformed dataset entries", () => {
    const malformed = structuredClone(dataset);
    malformed.zones[0].amountMinor = 0;
    malformed.zones[1].sourceIds = ["missing-source"];

    expect(validatePriceDataset(malformed, reviewDate)).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Price zone "gb-national" has an invalid amount.',
        ),
        expect.stringContaining('references missing source "missing-source"'),
      ]),
    );
  });

  it("rejects malformed roots without throwing", () => {
    expect(validatePriceDataset(null, reviewDate)).toEqual([
      "Price data must be an object.",
    ]);
    expect(validatePriceDataset({ zones: "not-an-array" }, reviewDate)).toEqual(
      expect.arrayContaining(["Price zones must be an array."]),
    );
  });

  it("enforces source identity and HTTPS provenance", () => {
    const malformed = structuredClone(dataset);
    malformed.sources.push({ ...malformed.sources[0] });
    malformed.sources[0].url = "http://example.com/prices";

    expect(validatePriceDataset(malformed, reviewDate)).toEqual(
      expect.arrayContaining([
        'Duplicate source ID "cga-regional-express-2025".',
        'Source "cga-regional-express-2025" URL must use HTTPS.',
      ]),
    );
  });

  it("pins every regional value to the explicitly published CGA table", () => {
    const expectedRegions: Record<string, number> = {
      "gb-london": 544,
      "gb-scotland": 442,
      "gb-wales": 421,
      "gb-northern-ireland": 442,
      "gb-north-east": 428,
      "gb-north-west": 442,
      "gb-yorkshire-humber": 442,
      "gb-east-midlands": 442,
      "gb-west-midlands": 442,
      "gb-east-of-england": 456,
      "gb-south-east": 494,
      "gb-south-west": 463,
    };

    for (const [id, amountMinor] of Object.entries(expectedRegions)) {
      expect(dataset.zones.find((entry) => entry.id === id)).toMatchObject({
        kind: "region",
        amountMinor,
        observedAt: "2025-05-17",
        sourceIds: ["cga-regional-express-2025"],
      });
    }
  });

  it("pins every city override to Finder's April 2026 table", () => {
    const expectedCities: Record<string, number> = {
      "gb-london-city": 675,
      "gb-birmingham": 504,
      "gb-manchester": 572,
      "gb-liverpool": 477,
      "gb-leeds": 524,
      "gb-newcastle": 528,
      "gb-bristol": 600,
      "gb-cardiff": 518,
      "gb-edinburgh": 600,
      "gb-glasgow": 488,
      "gb-belfast": 597,
    };

    for (const [id, amountMinor] of Object.entries(expectedCities)) {
      expect(dataset.zones.find((entry) => entry.id === id)).toMatchObject({
        kind: "city",
        amountMinor,
        observedAt: "2026-04-01",
        sourceIds: ["finder-city-prices-2026"],
      });
    }
  });

  it("rejects impossible, future, and stale observation dates", () => {
    const malformed = structuredClone(dataset);
    malformed.zones[0].observedAt = "2025-02-31";
    malformed.zones[1].observedAt = "2030-01-01";
    malformed.zones[2].observedAt = "2020-01-01";

    expect(validatePriceDataset(malformed, reviewDate)).toEqual(
      expect.arrayContaining([
        'Price zone "gb-national" observation date is invalid.',
        'Price zone "gb-london" observation date is future.',
        'Price zone "gb-scotland" observation date is stale.',
      ]),
    );
  });

  it("requires region parents and unambiguous aliases", () => {
    const malformed = structuredClone(dataset);
    const birmingham = malformed.zones.find(
      (entry) => entry.id === "gb-birmingham",
    )!;
    const manchester = malformed.zones.find(
      (entry) => entry.id === "gb-manchester",
    )!;
    birmingham.parentRegionId = "gb-national";
    manchester.aliases.push("Birmingham");

    expect(validatePriceDataset(malformed, reviewDate)).toEqual(
      expect.arrayContaining([
        'City "gb-birmingham" has no valid parent region.',
        expect.stringContaining("share ambiguous city alias"),
      ]),
    );
  });

  it("throws one actionable error from the parsing boundary", () => {
    expect(() => parsePriceDataset([], reviewDate)).toThrow(
      "Price data cannot be used: Price data must be an object.",
    );
  });
});
