# Full-stack integration proof

This document records the purpose and evidence boundary of the disposable `full-stack-integration-candidate` branch.

The candidate combines the current green P0 hardening integration with the full V3 / founder-UX stack without changing production.

## Conflict resolutions

Three integration conflicts were resolved additively:

1. `.github/workflows/v2-browser-smoke.yml`
   - Keep the P0 workflow because it runs every Chromium browser spec and the WebKit responsive device matrix.
2. `browser-tests/v2-release-smoke.spec.js`
   - Preserve the V3 Brand Engine coverage and append the P0 Shopify CSV and keyboard-accessibility cases exactly once.
3. `public/index.html`
   - Preserve the V3 / UX product surface and mount the P0 accessibility CSS and JavaScript exactly once.

`.github/workflows/test.yml` was then unioned through the normal repository write path so CI syntax-checks both P0 accessibility code and all V3 / UX / Brand Engine modules under Node 24.

## Safety boundary

This branch is proof-only. It does not authorize a production merge, database migration, provider mutation, customer mutation, billing change, or production environment change.

Passing repository and preview checks does not substitute for the remaining live/manual launch gates documented in P0 issue #1.
