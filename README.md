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

| Command                                 | Purpose                                                                                                         |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                           | Start the Vite development server.                                                                              |
| `npm run build`                         | Type-check and create the GitHub Pages build in `dist`.                                                         |
| `npm run lint` / `npm run format:check` | Run static checks.                                                                                              |
| `npm run test` / `npm run test:e2e`     | Run unit and Playwright browser tests.                                                                          |
| `npm run data:refresh-ons`              | Update only the ONS national benchmark and ONS source metadata. Review the resulting diff before committing it. |

## Location and privacy

The page makes no location request on load. Selecting **Use my location** asks the browser for low-accuracy location permission, then sends the current coordinates directly to [BigDataCloud](https://www.bigdatacloud.com/free-api/free-reverse-geocode-to-city-api) to obtain a city/region candidate. If permission or precise lookup fails, the app attempts BigDataCloud's client-side network-location fallback and labels it as approximate.

Visitors can always choose a city or region manually. The app stores only the selected pricing-zone ID and method in `sessionStorage`, scoped to the current browser tab. It never stores coordinates, IP addresses, postcodes, or a provider response. BigDataCloud availability, VPNs, mobile routing, and IP geolocation can all make an automatic result inaccurate.

## Prices and payment

Prices are committed in `src/data/uk-beer-prices.json` as integer pence. Resolution is city override, then regional fallback, then the ONS national benchmark. The data file includes observation/review dates, sources, methods, and aliases. Prices are estimates of a draught lager pint—not a venue quote—and must be reviewed before treating a new figure as current.

The national fallback is the latest usable value from the ONS [CZMS series](https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/czms/mm23), licensed under the Open Government Licence v3.0. City and regional estimates are clearly identified editorial indicators from the linked public guide; they are not fabricated live quotes. Add or change a zone only with a dated, attributable source and matching aliases. Ensure every new country has a national fallback, complete manual choices, tested location aliases, and verified payment-currency support before adding it to the resolver.

An enabled payment action uses the documented `https://paypal.me/<profile>/<amount>GBP` format. It opens PayPal in a new tab, where the visitor reviews the amount. This static app cannot know whether a payment succeeded and does not claim otherwise.

The bundled display and body faces are [Fraunces](https://fontsource.org/fonts/fraunces) and [Alegreya Sans](https://fontsource.org/fonts/alegreya-sans), delivered as local Vite assets from Fontsource packages under their respective OFL licences.

## GitHub Pages

Set **Settings → Pages → Source** to **GitHub Actions**, then add the repository variable `PAYPAL_ME_USERNAME` with the public PayPal.Me profile name. The deployment workflow validates it before building, uploads `dist`, and deploys with the repository-safe `/buymeabeer/` base path. CI runs formatting, linting, types, unit tests, Playwright tests, and the production build on pull requests and pushes to `main`.

Because this project is static, there are no accounts, server-side payments, analytics, cookies, webhooks, or service workers. Unsupported countries deliberately leave payment disabled rather than substituting a UK estimate.
