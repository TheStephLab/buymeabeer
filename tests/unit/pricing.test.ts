import datasetJson from "../../src/data/uk-beer-prices.json";
import {
  normalizeLocationName,
  resolvePrice,
  validatePriceDataset,
} from "../../src/domain/pricing";
import type { PriceDataset } from "../../src/types";

const dataset = datasetJson as PriceDataset;

describe("price dataset", () => {
  it("has complete UK fallback coverage and valid source references", () => {
    expect(validatePriceDataset(dataset)).toEqual([]);
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
      zone: { id: "gb-manchester", amountMinor: 478 },
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
      zone: { id: "gb-east-of-england", amountMinor: 492 },
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
      zone: { id: "gb-national", amountMinor: 483 },
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

    expect(validatePriceDataset(malformed)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Price zone "gb-national" is malformed.'),
        expect.stringContaining('references missing source "missing-source"'),
      ]),
    );
  });
});
