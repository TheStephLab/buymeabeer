# Buy Me a Beer

A privacy-minded, static GitHub Pages site that suggests an estimated UK pint price before opening an exact PayPal.Me amount. It is deliberately narrow: **the first release supports UK locations and GBP only.**

## Run it locally

Use Node 24 (see `.node-version`), then:

```bash
npm ci
cp .env.example .env.local
# Replace the example value with a public PayPal.Me profile name.
npm run dev
```

`VITE_PAYPAL_ME_USERNAME` is public build configuration, not a secret. The site keeps payment disabled when this value is absent, a placeholder, or not a valid PayPal.Me profile slug.

| Command                                 | Purpose                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                           | Start the Vite development server.                                          |
| `npm run build`                         | Type-check and create the GitHub Pages build in `dist`.                     |
| `npm run lint` / `npm run format:check` | Run static checks.                                                          |
| `npm run test` / `npm run test:e2e`     | Run unit tests or build and test the production Pages site with Playwright. |
| `npm run price:validate`                | Validate price structure, provenance, coverage, and current freshness.      |
| `npm run price:check-expiry`            | Fail when any observation expires within 60 days.                           |

## Location and privacy

The page makes no location request on load. Selecting **Use my location** asks the browser for low-accuracy location permission, then sends the current coordinates directly to [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) to obtain a city/region candidate. If permission or precise lookup fails, the app attempts BigDataCloud's client-side network-location fallback and labels it as approximate.

Visitors can always choose a city or region manually. The app stores only the selected pricing-zone ID and method in `sessionStorage`, scoped to the current browser tab. It never stores coordinates, IP addresses, postcodes, or a provider response. BigDataCloud availability, VPNs, mobile routing, and IP geolocation can all make an automatic result inaccurate.

## Prices and payment

Prices are committed in `src/data/uk-beer-prices.json` as integer pence. Resolution is city override, then regional fallback, then the UK-wide CGA estimate. The data file includes observation/review dates, sources, methods, and aliases. Prices are estimates of a draught lager pint—not a venue quote—and must be reviewed before treating a new figure as current.

The regional table and UK fallback are CGA/NIQ figures explicitly reproduced by [Express.co.uk](https://www.express.co.uk/life-style/food/2056579/uks-cheapest-most-expensive-areas) in May 2025. CGA's underlying sample and fieldwork are not public, so these are labelled secondary estimates rather than official statistics. City overrides come from Finder's [International Pint Price Map](https://www.finder.com/uk/banking/international-pint-price-map), which aggregates Expatistan and Numbeo observations as of April 2026. The selected amount shows its own observation date and source in the interface.

Every price must remain traceable to a source that explicitly publishes that locality's value. The runtime validator rejects observations older than 18 months, insecure source URLs, duplicate or missing sources, ambiguous aliases, invalid parent regions, and malformed dates. A weekly CI check warns 60 days before any observation expires; invalid data renders a safe unavailable state rather than enabling payment. Add or change a zone only with a dated, attributable source and matching aliases.

Checkout is isolated behind a provider interface so hosted payment services can be changed without coupling them to location or pricing. The current adapter uses the documented `https://paypal.me/<profile>/<amount>GBP` format. It opens PayPal in a new tab, where the visitor reviews the amount. This static app cannot know whether a payment succeeded and does not claim otherwise.

The bundled display and body faces are [Fraunces](https://fontsource.org/fonts/fraunces) and [Alegreya Sans](https://fontsource.org/fonts/alegreya-sans), delivered as local Vite assets from Fontsource packages under their respective OFL licences.

## GitHub Pages

Set **Settings → Pages → Source** to **GitHub Actions**, then add the repository variable `PAYPAL_ME_USERNAME` with the public PayPal.Me profile name. The deployment workflow runs only after CI succeeds on `main`, checks out that exact verified commit, runs the same profile validation as the application, builds, and deploys `dist` with the repository-safe `/buymeabeer/` base path.

Because this project is static, there are no accounts, server-side payments, analytics, cookies, webhooks, or service workers. Unsupported countries deliberately leave payment disabled rather than substituting a UK estimate.
