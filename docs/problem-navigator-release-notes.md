# Problem-first navigator release notes

This branch is stacked on `v3-brand-engine` / PR #21. It must not be merged to `main` before its base V3 work lands or the branch is rebased onto the resulting `main`.

## Scope

- Adds **Solve a Problem** to the Command Center.
- Opens in the existing accessible Brand OS modal instead of replacing calculator state.
- Covers low profit, pricing, inventory/reorders, acquisition/CAC, cash protection, drop affordability, Shopify numbers, and an unknown-problem path.
- Uses the structure **WHAT'S HAPPENING → WHY IT MATTERS → WHAT TO DO**.
- Reuses existing Brand OS workspaces and calculator inputs; it does not create a second calculation engine.
- Adds tap-to-explain finance terms without benchmark claims.
- Adds **Open guided help** on every problem card. The handoff reuses the first-party Beginner Guide, opens the relevant tool card, expands the relevant finance term when one is available, and never sends founder business data to an external help service.
- Contextual-help focus returns to the persistent menu trigger instead of a control inside the now-hidden navigator modal.
- Missing data remains unknown and the navigator does not write founder financial inputs.

## Verification gates

- Node contract coverage for route reuse, unknown-data boundaries, contextual first-party help, mobile/focus rules, and no storage/network mutation in the navigator model.
- Chromium desktop test confirms opening, contextual education, and routing do not mutate the existing founder state.
- Chromium verifies the relevant Beginner Guide tool and glossary term are focused/opened, and closing help restores focus to a persistent control.
- Chromium 390×844 test confirms drawer close, modal usability, no horizontal overflow, contextual explainer interaction, and navigation into Cash Forecast.
- Existing Brand OS and Brand Engine browser smoke remains part of the same workflow.

## Merge rule

Keep this PR draft while PR #21 is unmerged. Do not merge this branch directly over production until its base is reconciled with `main` and all checks are green.
