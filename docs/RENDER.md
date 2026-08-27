# Deploying to Render.com (free tier)

This template can deploy to Render as a split static frontend +
Docker backend. The same `make` workflow still drives local dev and
self-hosted Docker; Render is just an additional, zero-ops target
useful for public demos and small projects.

## TL;DR

```bash
# The repo already includes render.yaml for Beskar Forge. For a new fork,
# copy render.yaml.example and replace every <project> with your slug.
git add render.yaml && git commit -m "render blueprint" && git push

# Render dashboard: New + > Blueprint > pick this repo
# First sync prompts for any envVar with `sync: false` (secrets).
```

During the first sync, enter the value for `APP_API_KEY` when Render prompts
for the secret. After that, `git push origin main` auto-deploys both services;
no GitHub Action is required.

## Architecture

```
                            CDN (always free)
                                  |
              https://<project>.onrender.com   <-- static frontend (Vite dist/)
                                  |
                                  | VITE_API_URL=...
                                  v
              https://<project>-api.onrender.com  <-- Docker FastAPI
                                                       (free web service,
                                                        sleeps after 15 min)
```

Two separate Render services, two hostnames, **cross-origin**. The
static site holds the clean public URL; the API gets the suffix.

## Critical gotchas (verified, do not skip)

1. **`plan: free` is required on the Docker web service.** Without
   it Render defaults to a paid plan and prompts for a credit card.
2. **`plan: free` is REJECTED on the static site.** Static sites are
   always free.
3. **`region:` does not apply to static sites** (they are CDN-hosted
   globally). Set it only on the Docker backend when you want a specific
   region; `frankfurt` is a good default for European users. Omitting it uses
   Render's default region.
4. **Service names are globally unique across all Render users.** If
   `<project>` is taken, fall back to `<project>-app` or
   `<project>-demo` and update both names + `CORS_ORIGINS` +
   `TRUSTED_HOSTS` + `VITE_API_URL` accordingly.
5. **`sync: false` for every secret.** Declare it in `render.yaml` so
   the blueprint is the source of truth, but keep the value in the
   dashboard. Never commit real keys.

## The relative-fetch trap

Any raw `fetch('/api/...')` works on localhost and on a self-hosted
nginx-proxied Docker deploy, but **silently breaks on Render's split
deploy** — it hits the static site (404) instead of the API. The UI
shows a blank/loading state with no obvious error.

Audit before deploy:

```bash
rg -n "fetch\(['\"\`]/" frontend/src
```

Every API call must go through a single helper that resolves the
base URL. The template ships `frontend/src/utils/api.ts` exactly for
this; use it (or your own axios instance) for every request and
never hand-write a relative `/api/...` path in components.

## CORS preflight 400 ≠ CORS misconfiguration

When the frontend sends a non-simple request header (e.g.
`Cache-Control: no-store`), the browser preflights `OPTIONS` and
asks permission. If FastAPI's CORS `allow_headers` list doesn't
include that header, the preflight returns **400** and the browser
surfaces it as a generic "CORS policy" error — looks identical to a
cold-start failure.

Diagnose:

```bash
curl -i -X OPTIONS https://<project>-api.onrender.com/<path> \
  -H "Origin: https://<project>.onrender.com" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: cache-control"
# 400 = the header is not in allow_headers
```

Fix: drop the request-side header if it's cosmetic (a `_ts=` query
param already busts caches). Only widen `allow_headers` if the
header is functionally needed.

## Cold-start UX (the 30s pause is not a bug)

Free Docker services sleep after 15 minutes of idle and cold-start
in 30-60 seconds on the next request. During warm-up the backend
returns 502/503/504 **without CORS headers**, which the browser
again surfaces as misleading "CORS policy" errors.

The real fix is client-side retry + a friendly overlay, not CORS
config. Pattern:

- Axios response interceptor with exponential backoff
  (1.5s → 8s, ~35s total over 6 retries).
- Retries 502/503/504 and network-errors-with-no-response.
- Excludes `/health` so silent polls don't trigger warming UI.
- Emits `backend-waking` / `backend-ready` `window` events after a
  2s threshold so a global overlay component can show
  "Waking demo backend (~30s)..." and hide on recovery.

Reference implementation: beskarfolio commit `60d3318` —
`frontend/src/services/api.ts` + the `BackendWakingOverlay`
component.

## Quota safeguards for public demos

Do not add silent polling to a public demo by default. Keep explicit
user-triggered actions available, and add a named build-time setting only when
a real feature needs different demo behavior.

## Keepalive crons: usually skip

Free tier gives 750h/month. 24/7 keepalive uses ~720h — it fits, but
adds operational complexity. With the cold-start retry overlay UX,
the 30s wake reads as engineering polish rather than as broken.
Skip the cron unless analytics show people bouncing during cold
starts.

## Pre-populating demo data (zero-API-call demos)

Commit a curated subset of generated/runtime data so fresh clones
and public demos work with zero provider calls. Use `.gitignore`
allow-list pattern:

```
backend/data/historical_prices/*
!backend/data/historical_prices/AAPL_prices.csv
!backend/data/historical_prices/MSFT_prices.csv
```

Verify with `git check-ignore -v <path>` — it shows which rule
matched (the `!` line for tracked, the `*` line for ignored).

**CRITICAL: `.dockerignore` allow-list MUST mirror `.gitignore`
allow-list.** Common trap: git tracks the demo CSVs but
`.dockerignore` still excludes them, so the production image ships
without the data. Symptom: the demo shows real values for one
ticker (the one historically allow-listed in `.dockerignore`) and
"Est." placeholders for everything else, while the backend logs no
errors because empty reads fall back silently.

Audit both files together:

```bash
diff <(grep -E '!?data/historical_prices' .gitignore) \
     <(grep -E '!?data/historical_prices' backend/.dockerignore)
```

## Diagnosis order when the live demo errors

Browser "CORS policy" errors are usually misleading. Real causes,
in order of likelihood:

1. **Relative `fetch('/api/...')`** hitting the static site —
   check the Network tab for the actual URL hit.
2. **CORS preflight 400** from a non-allowlisted request header —
   diagnose with the `curl -X OPTIONS` snippet above.
3. **Cold start 502/503/504** — backend `/health` works fine but the
   real endpoint is starting; addressed by the retry interceptor.
4. **`Origin` mismatch** with `CORS_ORIGINS` — rare if `render.yaml`
   is the source of truth.

When the app works but shows estimated/placeholder data, suspect
`.dockerignore` stripping committed runtime data before the image
build (see "Pre-populating demo data" above).

## Backend Dockerfile expectations

Render injects `$PORT` and expects the container to bind to it. The
template's `backend/Dockerfile` honors `${PORT:-8060}` so the same
image works on Render and on local Docker Compose. Compose maps host
port `8062` to the container's internal port `8060` by default.

Don't hard-code `8060` in your `CMD`. If you add a custom entrypoint,
forward `$PORT` to uvicorn.

## When NOT to use Render

- You need a persistent disk (Render free tier is ephemeral).
- You need always-on background workers (free tier sleeps).
- Your stack is more than one frontend + one backend (use the
  Docker Compose self-hosted path; the forge is built for that
  shape).

For everything else, Render's free tier is the cheapest possible
"give me a public URL" path that this template supports.
