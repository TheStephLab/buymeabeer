import londonFixture from "../fixtures/bigdatacloud-london.json";
import {
  LocationServiceError,
  normalizeProviderResponse,
} from "../../src/services/geolocation";

describe("BigDataCloud response normalization", () => {
  it("keeps only the minimal candidate data needed to price a location", () => {
    const result = normalizeProviderResponse(londonFixture, "browser");

    expect(result).toEqual({
      countryCode: "GB",
      cityCandidates: ["London", "City of Westminster"],
      regionCandidates: [
        "England",
        "United Kingdom of Great Britain and Northern Ireland",
        "London",
      ],
      source: "browser",
    });
    expect(JSON.stringify(result)).not.toContain("SW1Y");
  });

  it("rejects a response without a country code", () => {
    expect(() => normalizeProviderResponse({ city: "Leeds" }, "ip")).toThrow(
      LocationServiceError,
    );
  });
});
