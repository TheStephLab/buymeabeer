import type { ResolvedPrice } from "../../src/types";
import { initialState, transition } from "../../src/ui/state";

const resolved: ResolvedPrice = {
  zone: {
    id: "gb-manchester",
    countryCode: "GB",
    kind: "city",
    label: "Manchester",
    parentRegionId: "gb-north-west",
    amountMinor: 572,
    currency: "GBP",
    observedAt: "2025-08-27",
    sourceIds: ["finder-city-prices-2026"],
    aliases: [],
  },
  level: "city",
  source: "manual",
  approximate: false,
};

describe("application state", () => {
  it("moves through locating and resolved states", () => {
    expect(transition(initialState, { type: "start" })).toMatchObject({
      status: "locating",
    });
    expect(
      transition(initialState, { type: "resolved", value: resolved }),
    ).toEqual({
      status: "resolved",
      resolved,
    });
  });

  it("keeps unsupported and manual-recovery states distinct", () => {
    expect(transition(initialState, { type: "unsupported" }).status).toBe(
      "unsupported",
    );
    expect(
      transition(initialState, {
        type: "needs-manual-location",
        message: "Choose a location.",
      }),
    ).toEqual({
      status: "needs-manual-location",
      message: "Choose a location.",
    });
    expect(
      transition({ status: "resolved", resolved }, { type: "reset" }),
    ).toEqual(initialState);
  });

  it("preserves the current estimate while editing", () => {
    expect(
      transition({ status: "resolved", resolved }, { type: "edit" }),
    ).toMatchObject({ status: "editing", resolved });
  });
});
