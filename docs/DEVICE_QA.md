# Motion Supply Brand OS — Mobile + Desktop QA

This runbook defines the automated portion of the P0 `Full mobile + desktop QA` launch gate.

## Automated matrix

The browser suite exercises these viewport classes:

- 1440 × 1100 desktop
- 1920 × 1080 desktop
- 768 × 1024 tablet portrait
- 1024 × 768 tablet landscape
- 390 × 844 phone portrait
- 844 × 390 phone landscape
- 320 × 568 narrow phone

At each viewport the automated matrix loads the Foundry Eight demo and traverses the founder-facing workspace families:

- Business Health
- Next Move
- Profit & Pricing
- Customer Acquisition
- Discount Ceiling
- Launch & Break-Even
- Store Funnel
- Shopify Import
- Inventory & Reorder
- Cash Checkpoint
- PO Cash Gate
- 3PL Decision
- Profit Guardrails
- Collection Stress
- Production Preflight
- Factory Quote Compare
- Cash Forecast
- Reorder Intelligence
- Operating Alerts
- Integrations
- Wholesale Economics
- Brands & SKUs

The matrix fails if a route cannot be opened, the app renders the generic workspace-load failure, an uncaught browser exception occurs, or the document itself overflows horizontally.

For mobile-navigation layouts it also verifies independent drawer dismissal through:

- close button
- backdrop
- Escape

The workflow captures dashboard, Profit & Pricing, and Cash Forecast screenshots at every viewport for visual review.

## What this automated matrix proves

A green run is evidence that the current browser bundle can traverse the major founder workspace surfaces at the tested sizes without uncaught browser exceptions or document-level horizontal overflow, and that the mobile drawer remains dismissible on the tested narrow/tablet widths.

It does **not** prove every real-device/browser combination, virtual keyboard behavior, OS text scaling, touch ergonomics, network degradation, authenticated cloud state, checkout/portal redirects, camera/photo flows, or screen-reader behavior.

## Manual acceptance still required before checking the full gate

On real or emulated production-like devices, inspect at least:

1. iPhone-class portrait and landscape
2. Android-class narrow portrait
3. iPad/tablet portrait and landscape
4. desktop Chromium at common laptop width
5. desktop Safari/WebKit or equivalent supported Safari device

For each, manually verify:

- sticky header does not obscure content
- sidebar/drawer opens and closes normally
- forms remain usable when the software keyboard is present
- tables/cards remain readable and intentional scroll containers do not leak page-level overflow
- modal content is reachable and closeable
- buttons are not clipped or overlapped
- account/sign-in/recovery surfaces fit without hidden controls
- legal/support pages remain readable
- no obvious content truncation at increased system text size
- portrait ↔ landscape rotation does not leave stale drawer/body-scroll state

Authenticated lifecycle, Stripe, screen-reader, and real Shopify-export acceptance are tracked by their separate P0 gates and should not be silently counted as complete by this device matrix.

## Gate rule

Do not check `Full mobile + desktop QA` from automated screenshots alone. Check it only after this matrix is green **and** the manual real-device/browser review above has been recorded.