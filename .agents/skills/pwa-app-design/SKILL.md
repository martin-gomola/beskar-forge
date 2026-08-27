---
name: pwa-app-design
description: Designs, hardens, and validates this installable PWA. Use for manifests, service workers, update rollout, icons, theme colors, Add to Home Screen, installed-mode behavior, iPhone safe areas, notch overlap, home indicator collisions, viewport issues, and offline recovery. Avoid for generic responsive CSS without a PWA concern.
---

# PWA App Design

Keep the application installable and reliable without adding a PWA framework or replacing the existing service worker.

## Workflow

1. Read the repository-root `docs/PWA.md` and inspect the current manifest, HTML head, root CSS, service worker, Vite build stamping, registration code, and update hook.
2. Classify the change:
   - identity: app name, description, theme, icons, or document title;
   - lifecycle: installation, first launch, backgrounding, storage, or update rollout;
   - viewport: safe areas, notch, home indicator, rotation, or cold-start height;
   - recovery: offline shell, stale assets, failed API, or interrupted update.
3. Preserve the existing build-version-stamped service-worker contract unless evidence shows it cannot satisfy the requested behavior.
4. Make the smallest coherent change across every surface that owns the behavior. A manifest change may also require HTML, CSS, icons, or service-worker changes.
5. Run `cd frontend && npm run build`. Inspect the emitted manifest and `dist/sw.js` when either is affected.
6. For installed-mode changes, state which browser and device checks ran. Treat a real-device cold launch as required evidence for iOS safe-area, storage, and first-paint claims.

## Invariants

- Keep manifest, HTML theme metadata, splash background, and initial app surface visually consistent.
- Keep 192x192 and 512x512 icons, an Android maskable icon, and an Apple touch icon.
- Keep generated build metadata out of the source service worker.
- Do not cache API responses unless the feature defines freshness, invalidation, and offline conflict behavior.
- Do not claim that Safari and an installed iOS app share live browser storage.
- Preserve a browser-mode fallback for installed-only behavior.
- Report physical-device validation gaps instead of treating desktop emulation as proof.

## Completion

Report the selected display and viewport behavior, files changed, build evidence, installed-mode checks, fallback behavior, and any device-validation gap.

## Dependencies

This skill requires only repository files and existing project commands. Icon regeneration may use ImageMagick as documented in `docs/PWA.md`; do not install it silently.
