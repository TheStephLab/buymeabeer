import type { LocationCandidate } from "../types";

const endpoint = "https://api.bigdatacloud.net/data/reverse-geocode-client";
const requestTimeoutMs = 7000;

export class LocationServiceError extends Error {
  public readonly code:
    | "unavailable"
    | "permission-denied"
    | "timeout"
    | "network"
    | "invalid-response";

  constructor(
    code:
      | "unavailable"
      | "permission-denied"
      | "timeout"
      | "network"
      | "invalid-response",
    message: string,
  ) {
    super(message);
    this.name = "LocationServiceError";
    this.code = code;
  }
}

export interface LocationProvider {
  reverseCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<LocationCandidate>;
  lookupIpLocation(): Promise<LocationCandidate>;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function administrativeNames(value: unknown): string[] {
  const localityInfo = asRecord(value);
  const administrative =
    localityInfo && Array.isArray(localityInfo.administrative)
      ? localityInfo.administrative
      : [];
  return administrative.flatMap((entry) => {
    const name = stringValue(asRecord(entry)?.name);
    return name ? [name] : [];
  });
}

export function normalizeProviderResponse(
  payload: unknown,
  source: LocationCandidate["source"],
): LocationCandidate {
  const record = asRecord(payload);
  const countryCode = stringValue(record?.countryCode);

  if (!record || !countryCode) {
    throw new LocationServiceError(
      "invalid-response",
      "The location service returned an incomplete result.",
    );
  }

  const cityCandidates = [
    stringValue(record.city),
    stringValue(record.locality),
  ].filter((candidate): candidate is string => Boolean(candidate));
  const regionCandidates = [
    stringValue(record.principalSubdivision),
    ...administrativeNames(record.localityInfo),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return {
    countryCode,
    cityCandidates: [...new Set(cityCandidates)],
    regionCandidates: [...new Set(regionCandidates)],
    source,
  };
}

export class BigDataCloudLocationProvider implements LocationProvider {
  async reverseCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<LocationCandidate> {
    return this.request(
      new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        localityLanguage: "en",
      }),
      "browser",
    );
  }

  async lookupIpLocation(): Promise<LocationCandidate> {
    return this.request(new URLSearchParams({ localityLanguage: "en" }), "ip");
  }

  private async request(
    parameters: URLSearchParams,
    source: LocationCandidate["source"],
  ): Promise<LocationCandidate> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      requestTimeoutMs,
    );

    try {
      const response = await fetch(`${endpoint}?${parameters.toString()}`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        throw new LocationServiceError(
          "network",
          "The location service is unavailable right now.",
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new LocationServiceError(
          "invalid-response",
          "The location service returned an unexpected result.",
        );
      }

      return normalizeProviderResponse(await response.json(), source);
    } catch (error) {
      if (error instanceof LocationServiceError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new LocationServiceError(
          "timeout",
          "The location service took too long to respond.",
        );
      }
      throw new LocationServiceError(
        "network",
        "The location service could not be reached.",
      );
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

function browserPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(
      new LocationServiceError(
        "unavailable",
        "This browser cannot share your location.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new LocationServiceError(
              "permission-denied",
              "Location permission was not granted.",
            ),
          );
          return;
        }
        if (error.code === error.TIMEOUT) {
          reject(
            new LocationServiceError("timeout", "Location lookup timed out."),
          );
          return;
        }
        reject(
          new LocationServiceError(
            "unavailable",
            "Your location could not be read.",
          ),
        );
      },
      {
        enableHighAccuracy: false,
        timeout: requestTimeoutMs,
        maximumAge: 0,
      },
    );
  });
}

export async function locateVisitor(
  provider: LocationProvider,
): Promise<LocationCandidate> {
  try {
    const position = await browserPosition();
    return await provider.reverseCoordinates(
      position.coords.latitude,
      position.coords.longitude,
    );
  } catch (error) {
    if (error instanceof LocationServiceError) {
      return provider.lookupIpLocation();
    }
    throw error;
  }
}
