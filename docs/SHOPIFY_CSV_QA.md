# Shopify CSV QA — P0 Evidence and Remaining Gate

Last audited: 2026-09-16

## What this tranche proves

Brand OS parses Shopify CSV files locally in the browser; raw customer rows do not need to be uploaded to the Brand OS server.

This tranche hardens and regression-tests the parser against schema-realistic Shopify Orders and Transaction-history shapes, including:

- quoted commas and escaped quotes
- UTF-8 BOM
- Windows CRLF line endings
- multiline quoted fields
- trailing empty values
- Shopify order continuation rows
- canceled versus non-canceled order totals
- successful sale/capture/refund transaction math
- failed transactions being ignored by captured-payment math
- unknown CSV schemas
- unterminated quoted fields
- quotes appearing inside an unquoted field
- unexpected characters after a closing quote
- blank column headers
- duplicate column headers
- non-numeric money and quantity cells

Malformed structures now fail closed instead of being silently converted into plausible business numbers.

## What this tranche does **not** prove

The P0 launch checklist explicitly requires:

> Shopify CSV parser QA with multiple real exports + malformed files

The repository fixtures in `tests/shopify.test.js` are deliberately schema-realistic synthetic fixtures. They are **not** labeled or treated as real merchant exports.

A search of the user's available conversation/Library CSV files during this audit did not surface a Shopify Orders export or Shopify Transaction-history export. Therefore the "multiple real exports" portion of the gate remains unproven.

Do not check the P0 Shopify CSV gate from synthetic tests alone.

## Real-export acceptance procedure

Use actual exports produced by Shopify Admin from a store the operator is authorized to access. Do not commit raw merchant exports because they can contain customer PII.

Test at least:

1. Two Orders exports from materially different order sets/date ranges.
2. One Transaction-history export containing at least sale/capture and refund behavior when available.
3. A file with multiple line items on at least one order when available.
4. A canceled/refunded order when available.
5. One deliberately malformed copy of an export to prove the UI surfaces a safe error rather than importing partial numbers.

For each real export, compare Brand OS output with Shopify/Admin source totals for the same file/window:

- order count
- units
- order total / non-canceled order total
- discounts where present
- captured sales
- refunds
- net captured payments

Any mismatch must be explained before the gate is checked. Do not adjust fixtures merely to make tests green if Shopify's actual export format disagrees with the parser.

## Privacy handling

Real merchant exports may contain names, email addresses, shipping/billing data, order notes, payment metadata, and other customer information.

- Keep raw exports outside Git.
- Never attach a raw export to a public issue or PR.
- Prefer a local/manual verification run for real-export acceptance.
- If a regression fixture must be retained, create a separately sanitized fixture with invented customer data and document that it is sanitized—not a raw production export.

## Launch-gate status

Parser hardening and malformed-file coverage can be considered implemented after this branch passes exact-head CI.

The overall P0 Shopify CSV gate must remain **unchecked** until the real-export acceptance procedure above has been performed with multiple actual Shopify exports and the results are recorded without exposing customer PII.