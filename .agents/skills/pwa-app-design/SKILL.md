---
name: pwa-app-design
description: Designs, hardens, and validates installable Progressive Web Apps. Use for manifest and installability, service workers, app-shell caching, offline and API recovery, update rollout, icons, theme colors, installed-mode behavior, iPhone safe areas, accessibility, performance, and browser/device validation. Avoid for generic responsive CSS, backend-only work, or deployment operations without a PWA concern.
---

# PWA App Design

Keep the application usable as a website and reliable as an installed app. Work
with the existing React/Vite, FastAPI, and hand-rolled service-worker seams;
do not add a PWA framework or replace the service worker without evidence.

## Default workflow

1. Define the target browsers, installed mode, offline promise, data sensitivity,
   and acceptance evidence. A PWA is progressively enhanced web software, not
   a guarantee that every browser exposes the same install or OS APIs.
2. Read `docs/PWA.md`, then inspect the current manifest, HTML head, root CSS,
   service worker, Vite build stamping, registration/update hook, API helper,
   storage owners, and relevant tests. For this starter, also inspect
   `frontend/scripts/check-pwa.mjs` and `docs/RENDER.md` when delivery or API
   hosting is involved.
3. Classify the work:
   - identity/install: manifest, icons, title, theme, install affordance;
   - lifecycle: registration, first launch, waiting worker, updates,
     backgrounding, permissions, or storage;
   - data/recovery: app shell, offline UI, IndexedDB, outbox, API failures,
     retries, conflicts, or reconnect;
   - viewport/interaction: safe areas, keyboard, rotation, touch, display mode,
     focus, reduced motion, or responsive layout;
   - delivery/security: HTTPS, headers, MIME types, SPA fallback, CORS,
     privacy, performance, or observability.
4. Map each behavior to its owner before editing. The service worker owns
   static shell assets; a feature owns dynamic local data and its schema,
   outbox, conflict, and recovery contract; the API/backend owns server state
   and authorization; the edge owns headers, caching, and routing.
5. Make the smallest coherent change across every owning surface. Preserve
   browser-mode and unsupported-platform fallbacks.
6. Run focused checks first, then `cd frontend && npm run build`. Inspect
   emitted `dist/manifest.json`, `dist/sw.js`, and other built assets whenever
   those surfaces are affected.

## Installability and app identity

- Serve the app over HTTPS. `localhost` and `127.0.0.1` are valid local
  development exceptions; a `file://` launch is not a substitute for a
  deployed installability check.
- Link the manifest from the shipped HTML. Keep `name`/`short_name`, a stable
  `id`, `start_url`, `scope`, `display`, `theme_color`, and `background_color`
  coherent. Once users install a fork, do not change its `id` casually.
- For Chromium installability, verify the current browser criteria: required
  name, start URL, display/display override, `prefer_related_applications` not
  requesting a native alternative, and 192px and 512px icons. Include a
  maskable icon when launcher cropping matters. Keep an Apple touch icon for
  iOS. Screenshots, shortcuts, orientation, `share_target`, file handlers, and
  other manifest members are optional and must earn their complexity.
- Do not treat a service worker or offline behavior as a universal technical
  prerequisite for installation. The app may still require one for its
  product reliability promise.
- Do not assume one install UI. Feature-detect `beforeinstallprompt` where it
  exists, call it only from an intentional user action, and provide a plain
  browser/OS instruction path where it does not. Never show an install button
  when the app is already installed unless there is a deliberate reason.
- Keep `document.title`, metadata, and route state useful in both browser tabs
  and installed windows. For multiple views, preserve unique deep-linkable URLs
  and configure the edge/server fallback for direct navigation.

## Service worker, shell, and updates

- Inspect the existing worker lifecycle before changing it. In this starter,
  build stamping creates a new shell cache, installation leaves the worker
  waiting, and the user-controlled update command is the only path to
  `skipWaiting()`.
- Keep install, message, and activate work bounded by `event.waitUntil()`.
  Accept only the narrowly scoped update message. Delete only owned, old cache
  names during activation; do not clear unrelated origin storage.
- Keep `clients.claim()` and a guarded `controllerchange` reload aligned with
  the update UX. Do not let a new worker control a page whose JavaScript came
  from an older build without an explicit compatibility decision.
- Precache only the versioned app shell and required static assets. Keep
  `index.html`, the worker, and manifest revalidatable at the edge while
  hashed assets can be immutable. Verify the generated precache rather than
  trusting the source placeholder.
- Keep `/api/` network-only by default. Never blanket-cache API responses to
  manufacture offline support. If a feature needs offline reads or writes,
  define freshness, ownership, schema migration, mutation idempotency, retry,
  conflict resolution, deletion/tombstone behavior, and user-visible status
  in that feature. A failed API request must produce a recoverable UI state.
- Do not add Workbox, Background Sync, push, or other platform APIs merely
  because a guide mentions them. Use the existing online/foreground/manual
  reconnect paths when they satisfy the feature; add a capability only with a
  support matrix and a fallback.

## Offline, storage, and permissions

- Separate shell availability from data availability. A cached shell can open
  while the backend is unreachable; it does not mean server data is current or
  that a mutation succeeded.
- Keep application localStorage namespaced and list every app-owned IndexedDB
  database in data-clear operations. Do not call `localStorage.clear()` on a
  shared origin. Treat browser eviction, quota, private browsing, and
  installed-app storage isolation as possible outcomes, not exceptional
  impossibilities.
- Never claim that a browser tab and an installed iOS Home Screen app share
  live storage without testing that exact release and platform. Persist
  important user work through the feature's explicit local and server contract.
- Request notifications and other permissions only after a user action and
  explain the value and denial/recovery path. Push notifications, badges,
  file handling, share targets, and orientation locks are optional platform
  enhancements, not starter guarantees.
- Keep sensitive data, credentials, and authorization decisions out of the
  SPA, service-worker caches, and unencrypted browser storage. Robots and
  `X-Robots-Tag` guide compliant crawlers; they are not authentication or
  privacy controls.

## Viewport, accessibility, and performance

- Default to `standalone` and the normal iOS viewport for lists, forms, and
  dashboards. Add `viewport-fit=cover` only for a genuinely full-bleed surface,
  then own every relevant `env(safe-area-inset-*)` inset for fixed UI. Do not
  use desktop emulation as proof that a cold-start white bar, notch, keyboard,
  rotation, or home-indicator collision is fixed.
- Use `100dvh`/fallback height intentionally, keep the first painted surface
  aligned with the manifest and HTML colors, and avoid fixed elements that can
  collide with the keyboard or home indicator. Keep browser-mode behavior
  usable when installed-only media queries or APIs are unavailable.
- Use semantic HTML controls, visible keyboard focus, logical headings and
  labels, sufficient contrast, touch-sized controls, reduced-motion support,
  and readable text. Test the actual interaction, not only the presence of an
  ARIA attribute. Treat 44px targets, 16px text, Lighthouse scores, FCP/TTI,
  and similar numbers as useful heuristics unless the product has adopted them
  as an explicit acceptance gate.
- Measure the core user journey on representative slow networks and devices.
  Prefer small bundles, responsive images, lazy work below the first task, and
  stable layout. Do not add resource hints, image formats, or code splitting
  without a measured benefit and a fallback.

## API, delivery, and security checks

- Route every frontend API call through the repository's single API-base helper
  so same-origin Nginx and split static/API deployments do not diverge. Do not
  use raw `fetch('/api/...')` when the project supports a configured API base.
- Distinguish transient backend wake-up, offline, authorization, validation,
  conflict, and permanent server errors. Retry idempotent reads only when the
  helper's policy allows it; never automatically repeat mutations without an
  idempotency contract. Show retry/manual recovery and preserve user input.
- Verify HTTPS, service-worker and manifest paths, MIME types, cache headers,
  SPA deep-link fallback, CORS, trusted hosts, CSP/security headers, and API
  authorization at the actual edge. A permissive public API key or CORS rule
  is not user authentication.
- Keep privacy/indexing policy intentional. If a fork becomes public, review
  robots, headers, metadata, sitemap, share previews, and sensitive data
  together rather than copying private defaults blindly.

## Validation matrix

Run the repository contract and record what was actually observed:

1. `cd frontend && npm run build` and `npm run check:pwa`; inspect manifest,
   icon dimensions/purposes, HTML metadata, generated precache, API bypass,
   worker waiting/update message, and built headers/assets.
2. Test browser mode and installed mode in Chromium and Safari where claimed;
   include Firefox when broad web compatibility matters. Check install affordance
   and fallback instructions separately on desktop, Android, and iOS.
3. Test first connected load, reload, offline warm start, slow/failing API,
   reconnect, manual retry, and any feature-specific queued mutation. Verify
   that stale server data is labeled and failed mutations are not reported as
   synced.
4. For update work, use two controlled tabs: new worker waits, the old app
   remains coherent, the explicit update activates it, old owned caches are
   removed, and each tab reloads at most once.
5. For installed iOS claims, force-quit and cold-launch on a physical device;
   rotate, open the keyboard, and inspect fixed top/bottom controls. Report the
   physical-device gap if this was not run.

## Completion

Report the selected display/install and viewport behavior, behavior owners,
files changed, browser/platform fallbacks, data/offline contract, commands and
fresh results, installed-mode checks, and any device or hosting validation gap.
Do not claim installability, offline correctness, storage behavior, or iOS
layout readiness from source inspection alone.

## Sources and boundaries

Read [`references/pwa-guidance-sources.md`](references/pwa-guidance-sources.md)
when the task needs source interpretation or a browser-support claim. MDN is
the primary browser guidance for this package. The supplied commercial guides
are useful for patterns and heuristics but do not turn vendor thresholds,
case-study results, storage limits, or platform claims into standards. NotebookLM
may synthesize supplied sources for discovery, but its prose is a draft: verify
normative instructions against the linked primary documentation and the live
repository before applying them.

## Dependencies

This skill requires repository files and existing project commands. It may use
NotebookLM or web research for source interpretation, but neither is required
to execute the local workflow. Icon regeneration may use ImageMagick as
documented in `docs/PWA.md`; do not install it silently.
