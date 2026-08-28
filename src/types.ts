export type PriceZoneKind = "country" | "region" | "city";
export type ResolutionSource = "browser" | "ip" | "manual" | "session";
export type ResolutionLevel = "city" | "region" | "national";

export interface PriceZone {
  id: string;
  countryCode: "GB";
  kind: PriceZoneKind;
  label: string;
  parentRegionId?: string;
  amountMinor: number;
  currency: "GBP";
  observedAt: string;
  sourceIds: string[];
  aliases: string[];
}

export interface PriceSource {
  id: string;
  publisher: string;
  title: string;
  url: string;
  publishedAt: string;
  accessedAt: string;
  licence?: string;
  methodologyNote: string;
}

export interface PriceDataset {
  schemaVersion: string;
  datasetVersion: string;
  reviewedAt: string;
  supportedCountries: ["GB"];
  nationalBenchmarkZoneId: string;
  zones: PriceZone[];
  sources: PriceSource[];
}

export interface LocationCandidate {
  countryCode: string;
  cityCandidates: string[];
  regionCandidates: string[];
  source: Exclude<ResolutionSource, "manual" | "session">;
}

export interface ResolvedPrice {
  zone: PriceZone;
  level: ResolutionLevel;
  source: ResolutionSource;
  approximate: boolean;
}

export type AppStatus =
  | "idle"
  | "locating"
  | "resolved"
  | "editing"
  | "unsupported"
  | "needs-manual-location";

export interface AppState {
  status: AppStatus;
  resolved?: ResolvedPrice;
  message?: string;
}
