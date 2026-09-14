# Mobile Store Release — P0 Checklist

Motion Supply Brand OS is currently a web application. Do not submit a thin web-view wrapper as the final store product. The mobile shell must feel native, preserve account/billing rules, and pass store privacy and deletion requirements.

## Shared release gates

- Production HTTPS domain and API health checks are stable.
- Signup, sign-in, refresh, sign-out, password recovery, and account deletion are tested on real devices.
- Business Memory and saved workspace data survive reinstall/sign-in as designed.
- Privacy Policy, Terms, support contact, and account-deletion path are reachable without broken links.
- No secrets or service-role credentials ship in the client bundle.
- Crash reporting and privacy-safe product analytics are configured and documented.
- App icons, launch assets, screenshots, store descriptions, age/content rating answers, and support URLs are final.
- Accessibility: Dynamic Type/text scaling, contrast, VoiceOver/TalkBack labels, focus order, and touch targets are checked.
- Offline/network-loss states, slow API responses, expired sessions, and billing failures have user-readable recovery states.

## Apple App Store

- Create the App Store Connect record and bundle identifier.
- Configure signing, capabilities, associated domains if used, and production build configuration.
- Complete App Privacy disclosures based on actual SDK/data behavior.
- Ensure in-app account deletion is discoverable for accounts created in-app.
- Review subscription purchase architecture before submission. If the native app unlocks digital features consumed in-app, implement the Apple-compliant purchase path rather than assuming web Stripe checkout is acceptable.
- Add Restore Purchases if Apple in-app subscriptions are used.
- Provide review notes and a working reviewer account when authentication blocks feature access.
- Test with TestFlight before production review.

## Google Play

- Create Play Console app and application ID.
- Configure app signing and release track.
- Complete Data safety disclosures from actual app behavior.
- Ensure account deletion requirements are met, including any required external deletion URL.
- Review billing architecture before submission. Digital subscriptions/features distributed through Play may require Google Play Billing rather than an in-app Stripe purchase flow.
- Complete content rating, target audience, ads declaration, and app-access instructions.
- Test internal/closed track before production rollout.

## Recommended implementation sequence

1. Stabilize the production web/API P0 build.
2. Choose the mobile shell architecture and establish native navigation/session storage.
3. Implement native-safe auth and deep links.
4. Implement store-compliant subscription entitlement mapping.
5. Add account deletion, legal/support surfaces, and privacy disclosures.
6. Run real-device QA and accessibility checks.
7. Ship internal/TestFlight builds, fix review blockers, then submit.
