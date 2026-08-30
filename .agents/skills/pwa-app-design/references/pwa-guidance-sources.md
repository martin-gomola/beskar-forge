# PWA guidance sources

This note records the source boundary for the repository-local
`pwa-app-design` skill. Remote pages are mutable; recheck browser-specific
claims when a task depends on them.

## Primary browser guidance

- [MDN: Best practices for PWAs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Best_practices)
  covers adapting to browsers and devices, progressive enhancement, offline
  experience, deep links, speed, accessibility, and app-like behavior.
- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
  covers the manifest link, Chromium installability members, HTTPS/localhost,
  browser/platform variation, and the fact that a service worker is not a
  universal installability prerequisite.

## Supplementary guidance supplied for research

- [PWAStore guidelines](https://www.pwastore.io/guidelines) is a practical
  checklist source for responsive UI, touch targets, security, performance,
  testing, and deployment. Its numeric thresholds are heuristics, not browser
  or web-platform requirements.
- [Seedium PWA development guide](https://seedium.io/blog/pwa-development-guide/)
  is useful for app-shell, offline-data, caching, performance, and deployment
  patterns. Treat vendor-specific storage limits and architecture claims as
  operational observations requiring current verification.
- [WeWeb PWA guide](https://www.weweb.io/blog/progressive-web-application-guide)
  is useful for feature discovery and high-level trade-offs. Treat commercial
  success statistics, cost claims, and no-code capability claims as marketing
  context rather than acceptance criteria.

## NotebookLM use

NotebookLM notebook: `Beskar Forge PWA Starter Guidance`.

NotebookLM was used to compare all five supplied pages and produce a draft
keep/add/defer checklist. It is not an authority and its generated synthesis
must not be copied into the skill without checking source wording, current
browser support, and this repository's existing contracts.

## Repository authority

For this starter, executable behavior and release evidence outrank any guide:

- `docs/PWA.md` defines the current shell, update, storage, notification,
  privacy, and physical-device release contract.
- `frontend/scripts/check-pwa.mjs` defines the automated PWA contract.
- `frontend/public/sw.js`, `frontend/src/hooks/useServiceWorkerUpdate.ts`,
  `frontend/src/utils/api.ts`, and feature storage modules define ownership and
  runtime behavior.
