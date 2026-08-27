# PWA guide

Beskar Forge ships as an installable, mobile-first PWA. The starter shell opens
from its cached assets after the first successful load and lets the user choose
when a downloaded update takes over. Application-specific offline state belongs
in the feature that needs it.

Run the automated contract before testing in a browser:

```bash
make check
```

The frontend build runs `npm run check:pwa`. It validates the manifest, icon
files, HTML metadata, generated precache, API caching policy, and worker update
lifecycle without adding another package.

## What the starter guarantees

| Concern | Starter behavior |
| --- | --- |
| Install identity | Stable manifest `id: /`, `standalone` display, 192/512 PNG icons, scalable maskable SVG, 180px Apple icon |
| Offline shell | Built HTML, JavaScript, CSS, manifest, and icons are precached |
| API behavior | `/api/*` stays network-only; feature code defines any offline fallback |
| Application state | The starter has no durable domain state; add storage only with a defined ownership and recovery contract |
| Update safety | A new worker installs and waits; the old cache remains until the user chooses **Update now** |
| Multi-tab behavior | Activation triggers one guarded reload in every controlled tab so tabs do not keep mixed app versions |
| Update checks | The browser checks hourly and when a visible app is overdue for a check |
| Mobile layout | The default viewport lets iOS own notch padding; fixed UI includes safe-area fallbacks |
| Install help | The browser and operating system provide the install affordance; add feature-specific guidance only when it creates value |

## How updates work

1. Vite stamps a build version and precache list into `frontend/public/sw.js`.
2. The browser downloads the new worker and its cache, then leaves it waiting.
3. `useServiceWorkerUpdate` observes `registration.waiting` and `updatefound`.
4. The app shows **Update now**. No cache is deleted yet.
5. The button sends `{ type: 'SKIP_WAITING' }` directly to the waiting worker.
6. During activation, the worker removes only old `app-shell-*` caches and claims
   clients.
7. Every controlled tab observes `controllerchange` and reloads once.

Do not put unconditional `skipWaiting()` back in the install handler. It can
make a new worker control a page whose JavaScript came from the previous build.
The message does not need a `MessageChannel` because this one-way command has no
reply; add a channel only if a future command needs a response.

## Offline and storage model

The shell and application data have different owners:

- The service worker caches built app files.
- The starter health check remains network-only and reports a retryable error
  when the backend cannot be reached.
- Feature code owns any local state, its versioning, and its offline conflict
  behavior.

For sensitive or multi-user data, use an authenticated backend design with an
explicit storage and recovery contract.

## Customize a new project

1. Change names and descriptions in `frontend/src/config/platform.ts`,
   `frontend/index.html`, and `frontend/public/manifest.json`.
2. Keep the manifest `id` stable after users install the app. Change it only
   when the fork intentionally needs a new install identity.
3. Replace `favicon.svg` and `icon-maskable.svg`, then regenerate the PNG files:

   ```bash
   cd frontend/public
   magick -background none -density 600 favicon.svg -resize 192x192 icon-192.png
   magick -background none -density 600 favicon.svg -resize 512x512 icon-512.png
   magick -background none -density 600 favicon.svg -resize 180x180 apple-touch-icon.png
   magick -background none -density 600 icon-maskable.svg -resize 512x512 icon-maskable-512.png
   ```

4. Keep important maskable artwork inside the central safe area. Launchers may
   crop the outer edge into circles or other shapes.
5. Keep `background_color` and the HTML `theme-color` aligned with the first
   painted surface.
6. Keep feature detection. Do not branch on Safari or iOS version strings.

The starter does not use `viewport-fit=cover`. Add it only for a real full-bleed
surface such as a map or video, then handle every safe-area inset yourself.

## Release proof

### Desktop and multi-tab

1. Run `make prod` and open `http://localhost:8082` in two tabs.
2. Confirm both tabs are controlled by the current worker.
3. Build and deploy a visible change without closing either tab.
4. Confirm the new worker is **waiting** and both tabs still use the old app.
5. Choose **Update now** in one tab.
6. Confirm both tabs reload once and show the new build.
7. Confirm old `app-shell-*` caches existed before acceptance and were removed
   only after activation.

### Offline cold start on a physical phone

1. Open the deployed HTTPS URL and add it to the home screen.
2. Confirm the starter screen loads and reports the backend health state.
3. Force-close the installed app.
4. Disable network access and launch it from the home screen.
5. Confirm the starter screen returns and the browser shell remains usable.
6. Rotate portrait to landscape and back; check the notch, keyboard, and home
   indicator areas.
7. Restore the network and confirm the health check can be retried.

A desktop responsive viewport is useful, but it does not replace this physical
iPhone check.

### Safari 26 service-worker debugging

On the Mac, open Safari's **Develop → Inspect Apps and Devices**. Find the page
or Home Screen Web App, open its three-dot menu, and enable **Automatically
Inspect New Service Workers**. Enable automatic pausing when you need to catch
install, message, or activate code before it finishes. Worker timeline entries
can then be inspected separately from the page.

## Browser-specific gaps to record

Keep these in release notes rather than hiding them behind abstractions:

- install prompts and wording differ by browser;
- local state in a browser tab and an installed home-screen app may be isolated;
- storage eviction and background execution policies remain browser-controlled;
- orientation locking and some platform APIs are not consistent across mobile
  browsers.

## Research notes

- [web.dev service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
  directly supports waiting workers, user-triggered `skipWaiting()`, observable
  lifecycle events, and hourly checks. It is the primary lifecycle source.
- [WebKit features in Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
  is the primary source for automatic worker inspection and feature detection
  instead of user-agent sniffing.
- [Netguru's iOS PWA tips](https://www.netguru.com/blog/pwa-ios) was useful for
  durable state, explicit install guidance, icons, and offline feedback. Some
  browser-support claims and code examples are historical, so they are not used
  as current compatibility facts.
- [Pony Foo on service-worker messaging](https://ponyfoo.com/articles/serviceworker-messagechannel-postmessage)
  was useful for keeping commands scoped to a worker. Its `MessageChannel`
  pattern is unnecessary for the starter's one-way update command.
