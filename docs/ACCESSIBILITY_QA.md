# Motion Supply Brand OS — Accessibility QA

Last audited: 2026-09-16

## Scope of this tranche

This accessibility pass addresses concrete keyboard and semantic failures found in the current production shell without changing financial calculations, founder data, billing, or persistence behavior.

The audit identified these failures on the pre-change app:

1. Dashboard Quick Actions were clickable `<div>` elements, so they were not keyboard-operable controls.
2. Core generated calculator labels were visually present but were not programmatically associated with their inputs.
3. The Shopify CSV file input did not have a programmatic accessible name tied to its visible prompt.
4. The destructive account-delete confirmation input relied on placeholder text instead of an accessible name.
5. There was no skip-to-main-content path.
6. Active navigation was represented visually with a class but not exposed as `aria-current`.
7. Focus styling was inconsistent across control types and there was no shared reduced-motion override.
8. Shared dialogs used a generic accessible label even when a visible dialog heading was available.

## Implemented behavior

`public/accessibility.js` is a shared progressive-enhancement layer. It:

- inserts a keyboard-visible **Skip to main content** link;
- gives the main content a stable focus target;
- exposes the current route title as a polite live region and labels the application content region with it;
- synchronizes active navigation with `aria-current="page"`;
- associates generated `.field` labels with their `input`, `select`, or `textarea` controls;
- links generated help text through `aria-describedby`;
- makes legacy Quick Action cards keyboard-focusable button controls supporting Enter and Space;
- gives the Shopify CSV picker and DELETE confirmation control explicit accessible names when no label is present;
- gives table header cells `scope="col"` when missing;
- uses visible dialog headings as the dialog accessible name when possible.

`public/accessibility.css` adds:

- a skip-link reveal on keyboard focus;
- a shared high-visibility `:focus-visible` outline;
- reduced-motion overrides for users who request reduced motion.

## Automated browser acceptance

The browser smoke must prove at minimum:

- skip link exists and moves focus to main content;
- active navigation exposes `aria-current="page"`;
- a Quick Action can be activated using Enter without a mouse;
- the route changes after keyboard activation;
- a generated calculator input has an ID with a corresponding `<label for>`;
- Shopify file input has an accessible name;
- no uncaught browser error is produced by the accessibility layer.

Existing mobile-navigation and modal focus-trap tests remain part of the release suite and must stay green.

## Manual acceptance still required before checking the P0 gate

Automated Chromium checks do not prove the full assistive-technology experience. The P0 **Accessibility pass** checkbox should remain unchecked until a manual pass records all of the following on a release candidate:

1. **Keyboard only — desktop:** Tab/Shift+Tab through shell, navigation, forms, dialogs, details/summary controls and destructive actions; no keyboard trap except intentional modal trapping.
2. **Keyboard only — mobile-width layout:** open/close drawer, move through controls, close with Escape, and confirm focus returns to the visible trigger.
3. **Screen reader:** at least one supported desktop or mobile screen reader (for example VoiceOver or NVDA) reads route title, current navigation item, form labels/help, dialog name/status messages, tables and validation/error feedback coherently.
4. **Zoom/reflow:** browser zoom at 200% and 400% on representative dashboard/form views without loss of functionality or required two-dimensional scrolling for ordinary content.
5. **Reduced motion:** OS/browser reduced-motion preference produces no meaningful motion dependency.
6. **Contrast/meaning:** important status information remains understandable without relying on color alone and interactive focus remains visible against its background.
7. **Signup/account recovery:** email/password controls, status messages, recovery, and account deletion can be completed and understood with keyboard/screen-reader navigation.

Record non-sensitive evidence (browser/device, assistive technology/version, views tested, failures/fixes) in the P0 issue or release record.

## Gate interpretation

This tranche fixes and regression-locks the concrete automated accessibility failures found in the current app. It does **not** relabel an automated DOM/keyboard smoke as a complete human assistive-technology audit.
