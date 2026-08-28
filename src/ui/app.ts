import type { PriceDataset, ResolvedPrice, ResolutionSource } from "../types";
import { formatPounds, type PaymentProvider } from "../domain/payment";
import { resolvePrice } from "../domain/pricing";
import {
  BigDataCloudLocationProvider,
  locateVisitor,
  type LocationProvider,
} from "../services/geolocation";
import { initialState, transition } from "./state";

const storageKey = "buymeabeer-selection-v1";

interface PersistedSelection {
  zoneId: string;
  source: ResolutionSource;
}

function isPersistedSelection(value: unknown): value is PersistedSelection {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const stored = value as Record<string, unknown>;
  return (
    typeof stored.zoneId === "string" &&
    typeof stored.source === "string" &&
    ["browser", "ip", "manual", "session"].includes(stored.source)
  );
}

function isStorageUnavailable(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    ["SecurityError", "QuotaExceededError"].includes(error.name)
  );
}

function removeStoredSelection(): void {
  try {
    sessionStorage.removeItem(storageKey);
  } catch (error) {
    if (!isStorageUnavailable(error)) {
      throw error;
    }
  }
}

function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Expected "${selector}" to exist.`);
  }
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function sourceText(source: ResolutionSource): string {
  if (source === "ip") {
    return "Approximate location from your network";
  }
  if (source === "manual") {
    return "Location selected by you";
  }
  if (source === "session") {
    return "Saved for this browser tab";
  }
  return "Location shared for this estimate";
}

function resolutionLabel(resolved: ResolvedPrice): string {
  if (resolved.level === "national") {
    return "UK average";
  }
  return `Average in ${resolved.zone.label}`;
}

function formatObservationDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function optionGroups(dataset: PriceDataset): string {
  const regions = dataset.zones.filter((zone) => zone.kind === "region");
  const cities = dataset.zones.filter((zone) => zone.kind === "city");
  const cityOptions = regions
    .map((region) => {
      const options = cities
        .filter((city) => city.parentRegionId === region.id)
        .map(
          (city) =>
            `<option value="${escapeHtml(city.id)}">${escapeHtml(city.label)}</option>`,
        )
        .join("");
      return options
        ? `<optgroup label="${escapeHtml(region.label)}">${options}</optgroup>`
        : "";
    })
    .join("");
  const regionOptions = regions
    .map(
      (region) =>
        `<option value="${escapeHtml(region.id)}">${escapeHtml(region.label)} region</option>`,
    )
    .join("");

  return `<option value="">Choose a city or region</option>${cityOptions}<optgroup label="Regional estimates">${regionOptions}</optgroup>`;
}

function loadStoredSelection(dataset: PriceDataset): ResolvedPrice | undefined {
  let value: string | null;
  try {
    value = sessionStorage.getItem(storageKey);
  } catch (error) {
    if (isStorageUnavailable(error)) {
      return undefined;
    }
    throw error;
  }

  if (!value) {
    return undefined;
  }

  try {
    const stored = JSON.parse(value) as unknown;
    if (!isPersistedSelection(stored)) {
      removeStoredSelection();
      return undefined;
    }
    const zone = dataset.zones.find(
      (candidate) => candidate.id === stored.zoneId,
    );
    if (!zone) {
      removeStoredSelection();
      return undefined;
    }
    return {
      zone,
      level:
        zone.kind === "city"
          ? "city"
          : zone.kind === "region"
            ? "region"
            : "national",
      source: "session",
      approximate: stored.source === "ip",
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      removeStoredSelection();
      return undefined;
    }
    throw error;
  }
}

function persistSelection(resolved: ResolvedPrice): void {
  const stored: PersistedSelection = {
    zoneId: resolved.zone.id,
    source: resolved.source,
  };
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(stored));
  } catch (error) {
    if (!isStorageUnavailable(error)) {
      throw error;
    }
  }
}

export function createApp(
  root: HTMLElement,
  dataset: PriceDataset,
  paymentProvider: PaymentProvider,
  locationProvider: LocationProvider = new BigDataCloudLocationProvider(),
): void {
  let state = initialState;
  const stored = loadStoredSelection(dataset);
  if (stored) {
    state = transition(state, { type: "resolved", value: stored });
  }

  root.innerHTML = `
    <div class="page-shell">
      <header class="masthead">
        <a class="pub-sign" href="./" aria-label="Buy Me a Beer home"><span>BUY</span><strong>ME A BEER</strong></a>
        <p class="masthead-note">UK pint estimates · no tracking</p>
      </header>
      <section class="hero" aria-labelledby="page-title">
        <div class="hero-copy">
          <p class="eyebrow">A small round, properly priced</p>
          <h1 id="page-title">A pint,<br><em>priced where you are.</em></h1>
          <p class="intro">A local estimate, a clear amount, and no awkward guesswork at checkout.</p>
        </div>
        <article class="beer-card" id="beer-card" aria-labelledby="price-heading">
          <div class="hop-mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
          <p class="card-kicker">TODAY'S ROUND</p>
          <p id="location-status" class="location-status" aria-live="polite"></p>
          <p id="price-heading" class="price" aria-live="polite">—</p>
          <p id="price-context" class="price-context">Choose how you would like to set your UK location.</p>
          <p id="price-source" class="price-source" hidden></p>
          <div class="location-actions">
            <button class="button button-primary" id="locate-button" type="button">Use my location</button>
            <p class="location-consent">This asks your browser for coordinates and sends them to BigDataCloud. If unavailable, BigDataCloud may estimate your area from your IP address. <a href="./legal.html#privacy" target="_blank" rel="noopener noreferrer">Privacy notice</a>.</p>
            <label class="manual-label" for="manual-location">Or choose it yourself</label>
            <select id="manual-location" name="location">${optionGroups(dataset)}</select>
          </div>
          <div class="gift-confirmation">
            <input id="gift-acceptance" type="checkbox" disabled>
            <label for="gift-acceptance">I understand this is a real, voluntary personal gift. No alcohol, goods, services or rewards are supplied in return, and I agree to the <a href="./legal.html#terms" target="_blank" rel="noopener noreferrer">gift terms</a>.</label>
          </div>
          <a id="payment-link" class="button button-payment is-disabled" role="button" aria-disabled="true">Choose a location to buy a beer</a>
          <p id="payment-note" class="payment-note">Payment opens with the payment provider. You can review the exact amount before paying.</p>
          <div class="card-tools">
            <button id="change-location" class="text-button" type="button" hidden>Change location</button>
            <button id="forget-location" class="text-button" type="button" hidden>Forget this location</button>
          </div>
        </article>
      </section>
      <section class="trust-strip" aria-label="How this works">
        <p><strong>Private by design.</strong> We ask only when you choose “Use my location”.</p>
        <p><strong>Always your choice.</strong> A manual UK location works without location permission.</p>
      </section>
      <section class="details-grid">
        <details>
          <summary>How this is worked out <span aria-hidden="true">+</span></summary>
          <div class="details-copy">
            <p>City figures take priority, then broader regional estimates, then the UK average. Prices are estimates of a draught lager pint, not a promise of any pub’s menu price.</p>
            <p id="data-review"></p>
          </div>
        </details>
        <details>
          <summary>Your location & privacy <span aria-hidden="true">+</span></summary>
          <div class="details-copy">
            <p>With permission, your current coordinates are sent directly to BigDataCloud to identify a city or region. If that is unavailable, its network-location result may be used as an approximate fallback. This app stores only the selected price zone in this browser tab—not coordinates, IP addresses, postcodes, or provider responses.</p>
            <p><a href="https://www.bigdatacloud.com/docs/article/fair-use-policy-for-free-client-side-reverse-geocoding-api" target="_blank" rel="noopener noreferrer">Read BigDataCloud's fair-use policy</a>.</p>
          </div>
        </details>
      </section>
      <footer>
        <p>Prices are estimates, reviewed ${dataset.reviewedAt}. Sources: ${dataset.sources
          .map(
            (source) =>
              `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.publisher)}</a>`,
          )
          .join(" · ")}.</p>
        <nav class="footer-links" aria-label="Legal">
          <a href="./legal.html#terms">Gift terms</a>
          <a href="./legal.html#privacy">Privacy notice</a>
        </nav>
      </footer>
    </div>
  `;

  const locationStatus = requiredElement<HTMLParagraphElement>(
    root,
    "#location-status",
  );
  const price = requiredElement<HTMLParagraphElement>(root, "#price-heading");
  const priceContext = requiredElement<HTMLParagraphElement>(
    root,
    "#price-context",
  );
  const priceSource = requiredElement<HTMLParagraphElement>(
    root,
    "#price-source",
  );
  const locateButton = requiredElement<HTMLButtonElement>(
    root,
    "#locate-button",
  );
  const manualLocation = requiredElement<HTMLSelectElement>(
    root,
    "#manual-location",
  );
  const paymentLink = requiredElement<HTMLAnchorElement>(root, "#payment-link");
  const paymentNote = requiredElement<HTMLParagraphElement>(
    root,
    "#payment-note",
  );
  const giftAcceptance = requiredElement<HTMLInputElement>(
    root,
    "#gift-acceptance",
  );
  const changeLocation = requiredElement<HTMLButtonElement>(
    root,
    "#change-location",
  );
  const forgetLocation = requiredElement<HTMLButtonElement>(
    root,
    "#forget-location",
  );
  const dataReview = requiredElement<HTMLParagraphElement>(
    root,
    "#data-review",
  );

  dataReview.textContent = `Dataset ${dataset.datasetVersion}; last reviewed ${dataset.reviewedAt}.`;

  const applyResolved = (resolved: ResolvedPrice): void => {
    giftAcceptance.checked = false;
    state = transition(state, { type: "resolved", value: resolved });
    persistSelection(resolved);
    render();
  };

  const render = (): void => {
    const resolved = state.resolved;
    const paymentUrl =
      state.status === "resolved" && resolved
        ? paymentProvider.createPaymentUrl(resolved.zone.amountMinor)
        : undefined;
    const hasResolvedPrice = state.status === "resolved" && Boolean(resolved);
    const canAcceptGiftTerms =
      hasResolvedPrice && Boolean(paymentUrl) && state.status === "resolved";

    locationStatus.textContent =
      state.message ??
      (resolved
        ? sourceText(resolved.source)
        : "Your location stays in your control.");
    price.textContent = resolved
      ? formatPounds(resolved.zone.amountMinor)
      : "—";
    priceContext.textContent = resolved
      ? `${resolutionLabel(resolved)}${resolved.approximate ? " · approximate" : ""}${state.status === "editing" ? " · choose a replacement below" : ""}`
      : state.status === "unsupported"
        ? "UK locations are supported in this first edition."
        : "Choose how you would like to set your UK location.";
    priceSource.replaceChildren();
    priceSource.hidden = !resolved;
    if (resolved) {
      const sources = dataset.sources.filter((source) =>
        resolved.zone.sourceIds.includes(source.id),
      );
      priceSource.append(
        document.createTextNode(
          `Observed ${formatObservationDate(resolved.zone.observedAt)} · ${
            sources.length === 1 ? "Source: " : "Sources: "
          }`,
        ),
      );
      for (const [index, source] of sources.entries()) {
        if (index > 0) {
          priceSource.append(document.createTextNode(" · "));
        }
        const link = document.createElement("a");
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.referrerPolicy = "no-referrer";
        link.textContent = source.publisher;
        priceSource.append(link);
      }
    }
    locateButton.disabled = state.status === "locating";
    locateButton.textContent =
      state.status === "locating" ? "Finding your area…" : "Use my location";
    manualLocation.disabled = state.status === "locating";
    giftAcceptance.disabled = !canAcceptGiftTerms;
    changeLocation.hidden = !hasResolvedPrice;
    forgetLocation.hidden = !hasResolvedPrice;

    if (paymentUrl && resolved && giftAcceptance.checked) {
      const amount = formatPounds(resolved.zone.amountMinor);
      paymentLink.href = paymentUrl.toString();
      paymentLink.target = "_blank";
      paymentLink.rel = "noopener noreferrer";
      paymentLink.referrerPolicy = "no-referrer";
      paymentLink.classList.remove("is-disabled");
      paymentLink.removeAttribute("aria-disabled");
      paymentLink.removeAttribute("tabindex");
      paymentLink.textContent = `Buy me a beer for ${amount}`;
      paymentNote.textContent = `This real one-off gift opens on ${paymentProvider.displayName}. Review the exact amount before paying.`;
    } else {
      paymentLink.removeAttribute("href");
      paymentLink.removeAttribute("target");
      paymentLink.classList.add("is-disabled");
      paymentLink.setAttribute("aria-disabled", "true");
      paymentLink.tabIndex = -1;
      paymentLink.textContent =
        state.status === "editing"
          ? "Choose a new location to continue"
          : hasResolvedPrice
            ? paymentUrl
              ? "Confirm this is a voluntary gift"
              : "Payment provider needs to be configured"
            : "Choose a location to buy a beer";
      paymentNote.textContent =
        hasResolvedPrice && paymentProvider.configurationError
          ? paymentProvider.configurationError
          : hasResolvedPrice && paymentUrl
            ? "Read and accept the gift terms before continuing to PayPal."
            : `Payment opens on ${paymentProvider.displayName} once a UK price is selected.`;
    }
  };

  locateButton.addEventListener("click", async () => {
    giftAcceptance.checked = false;
    state = transition(state, { type: "start" });
    render();

    try {
      const location = await locateVisitor(locationProvider);
      if (location.countryCode.toUpperCase() !== "GB") {
        state = transition(state, { type: "unsupported" });
      } else {
        const resolved = resolvePrice(location, dataset);
        if (!resolved) {
          state = transition(state, {
            type: "needs-manual-location",
            message:
              "We could not match that UK location. Please choose one below.",
          });
          render();
          manualLocation.focus();
          return;
        } else {
          applyResolved({
            ...resolved,
            source: location.source,
            approximate: location.source === "ip",
          });
          return;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        state = transition(state, {
          type: "needs-manual-location",
          message:
            "We could not find a location. Please choose a UK area below.",
        });
        render();
        manualLocation.focus();
        return;
      } else {
        throw error;
      }
    }
    render();
  });

  manualLocation.addEventListener("change", () => {
    const zone = dataset.zones.find(
      (candidate) => candidate.id === manualLocation.value,
    );
    if (!zone) {
      return;
    }
    applyResolved({
      zone,
      level:
        zone.kind === "city"
          ? "city"
          : zone.kind === "region"
            ? "region"
            : "national",
      source: "manual",
      approximate: false,
    });
  });

  changeLocation.addEventListener("click", () => {
    giftAcceptance.checked = false;
    state = transition(state, { type: "edit" });
    manualLocation.value = "";
    render();
    manualLocation.focus();
  });

  forgetLocation.addEventListener("click", () => {
    giftAcceptance.checked = false;
    removeStoredSelection();
    manualLocation.value = "";
    state = transition(state, { type: "reset" });
    render();
  });

  paymentLink.addEventListener("click", (event) => {
    if (!paymentLink.href) {
      event.preventDefault();
    }
  });

  giftAcceptance.addEventListener("change", render);

  render();
}
