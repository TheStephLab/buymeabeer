import type { AppState, ResolvedPrice } from "../types";

export type AppEvent =
  | { type: "start" }
  | { type: "resolved"; value: ResolvedPrice }
  | { type: "unsupported" }
  | { type: "needs-manual-location"; message: string }
  | { type: "error"; message: string }
  | { type: "reset" };

export const initialState: AppState = { status: "idle" };

export function transition(state: AppState, event: AppEvent): AppState {
  switch (event.type) {
    case "start":
      return { status: "locating", message: "Finding a nearby pint price…" };
    case "resolved":
      return { status: "resolved", resolved: event.value };
    case "unsupported":
      return {
        status: "unsupported",
        message:
          "This first edition is priced for the UK. Please choose a UK location to continue.",
      };
    case "needs-manual-location":
      return { status: "needs-manual-location", message: event.message };
    case "error":
      return { status: "error", message: event.message };
    case "reset":
      return initialState;
    default:
      return state;
  }
}
