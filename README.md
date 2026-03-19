# Perpetual Bitcoin — Website

Static website source for the Perpetual Bitcoin protocol.

This repo contains the browser-runnable site files used for local download/use and for publishing the website bundle. It includes the main landing pages, docs pages, presale flow, simulator, and the modular test dApp scripts.

## Run Locally

1. Clone or download this repo.
2. Open `index.html` in a browser.

No build step is required for basic local viewing.

## Main Pages

| File | Purpose |
|------|---------|
| `index.html` | Main landing page |
| `faq.html` | FAQ |
| `whitepaperLite.html` | Whitepaper Lite |
| `PBManifesto.html` | Project manifesto |
| `WHY.html` | Why PB overview page |
| `trust-center.html` | Trust and safety page |
| `immutable-rules.html` | Immutable rules summary |
| `pb-in-60-seconds.html` | Short-form explainer |
| `portfolio.html` | Portfolio page |
| `presale-dapp.html` | Presale dApp |
| `simulator.html` | Protocol simulator |
| `testDapp.html` | Full testnet dApp |

## Shared Runtime Files

These files support the pages above:

- `config.js`
- `disclaimer.js`
- `styles.css`
- `ticker.js`
- `price-ticker.js`

## Test dApp Modules

The full dApp is split across these source files:

- `testdapp-core.js`
- `testdapp-contracts.js`
- `testdapp-trades.js`
- `testdapp-positions.js`
- `testdapp-recovery.js`
- `testdapp-vlock.js`
- `testdapp-chart.js`
- `testdapp-faucet.js`
- `testdapp-wallet.js`

## Assets And Libraries

- `Pic/` contains site images and downloadable docs.
- `lib/` contains locally bundled browser libraries used by the site bundle.

## IPFS

The deployable IPFS bundle is generated from the website source and pinned separately for static hosting.

## Links

- Twitter/X: [@PerpetualB67383](https://twitter.com/PerpetualB67383)
- Telegram: [t.me/Perpetual_Bitcoin](https://t.me/Perpetual_Bitcoin)

---

Built on PulseChain. One Price. One Pool. One Truth.
