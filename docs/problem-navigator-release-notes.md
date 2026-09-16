# Problem-first navigator release notes

This branch is stacked on `v3-brand-engine` / PR #21. It must not be merged to `main` before its base V3 work lands or the branch is rebased onto the resulting `main`.

## Scope

- Adds **Solve a Problem** to the Command Center.
- Opens in the existing accessible Brand OS modal instead of replacing calculator state.
- Covers low profit, pricing, inventory/reorders, acquisition/CAC, cash protection, drop affordability, Shopify numbers, and an unknown-problem path.
- Uses the structure **WHAT'S HAPPENING → WHY IT MATTERS → WHAT TO DO**.
- Reuses existing Brand OS workspaces and calculator inputs; it does not create a second calculation engine.
- Adds contextual finance explainers without benchmark claims.
- Missing data remains unknown and the navigator does not write founder financial inputs.

## Verification gates

- Node contract coverage for route reuse, unknown-data boundaries, mobile/focus rules, and no storage/network mutation in the navigator model.
- Chromium desktop test confirms opening and routing do not mutate the existing founder state.
- Chromium 390×844 test confirms drawer close, modal usability, no horizontal overflow, contextual explainer interaction, and navigation into Cash Forecast.
- Existing Brand OS and Brand Engine browser smoke remains part of the same workflow.

## Merge rule

Keep this PR draft while PR #21 is unmerged. Do not merge this branch directly over production until its base is reconciled with `main` and all checks are green.
