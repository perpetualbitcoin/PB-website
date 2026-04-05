# Perpetual Bitcoin - Website

Static website source for the Perpetual Bitcoin protocol.

This repo contains the browser-runnable site files used for the downloadable website bundle. It mirrors the current public site pages, docs, and main dapp runtime.

## Run Locally

1. Clone or download this repo.
2. Open index.html in a browser.

No build step is required for normal local viewing.

## Main Pages

| File | Purpose |
|------|---------|
| index.html | Main landing page |
| faq.html | Frequently asked questions |
| whitepaper.html | Primary whitepaper page |
| PBManifesto.html | Protocol manifesto |
| portfolio.html | Portfolio and position overview |
| Dapp.html | Main public dapp |
| DEV.html | Developer and contract reference |
| simulator.html | Protocol simulator |

## Shared Runtime Files

- config.js
- disclaimer.js
- styles.css
- ticker.js
- price-ticker.js

## Dapp Modules

- dapp-core.js
- dapp-contracts.js
- dapp-trades.js
- dapp-positions.js
- dapp-recovery.js
- dapp-vlock.js
- dapp-remove-lp.js
- dapp-chart.js
- dapp-faucet.js
- dapp-wallet.js

## Assets

- Pic/ contains site images and downloadable PDFs.

## Distribution

- website-lite/ is the editable source of truth in the main workspace.
- PB-website-repo/ is the GitHub-downloadable website copy.
- ipfs-build/ is the generated Pinata/IPFS deployment bundle.

Built on PulseChain. One Price. One Pool. One Truth.
