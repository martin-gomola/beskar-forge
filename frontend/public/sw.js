// Service Worker - build metadata is replaced at build time by Vite.
const BUILD_VERSION = '__BUILD_VERSION__'
const CACHE_PREFIX = 'app-shell'
const CACHE_NAME = `${CACHE_PREFIX}-${BUILD_VERSION}`
const OFFLINE_DOCUMENT_URL = '/index.html'
const PRECACHE_URLS = __PRECACHE_URLS__

const STATIC_ASSETS = Array.from(new Set([
  '/',
  OFFLINE_DOCUMENT_URL,
  '/favicon.svg',
  '/manifest.json',
  ...PRECACHE_URLS,
]))

const isSameOrigin = (url) => url.origin === self.location.origin

const isCacheableStaticRequest = (request, url) => (
  isSameOrigin(url) &&
  !url.pathname.startsWith('/api/') &&
  request.mode !== 'navigate'
)

const getCacheKey = (request) => {
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    return OFFLINE_DOCUMENT_URL
  }

  if (isCacheableStaticRequest(request, url)) {
    return url.pathname
  }

  return request
}

const matchCachedResponse = (request) => caches.match(getCacheKey(request))

const cachePutSafe = async (request, response) => {
  if (!response || response.bodyUsed) return
  if (!response.ok) return
  if (response.status === 206) return
  try {
    const cache = await caches.open(CACHE_NAME)
    await cache.put(getCacheKey(request), response.clone())
  } catch (_) {
    // Ignore cache failures (opaque responses, quota)
  }
}

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
})

// A deployed worker stays waiting until the user accepts the update.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SKIP_WAITING') return
  event.waitUntil(self.skipWaiting())
})

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(`${CACHE_PREFIX}-`) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ])
  )
})

// Fetch strategy:
// - Navigation (HTML): network-first
// - API calls: network-only
// - Static assets: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return

  // API: network-only
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
    )
    return
  }

  // Navigation: network-first (always get latest index.html)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          event.waitUntil(cachePutSafe(request, response))
          return response
        })
        .catch(() =>
          matchCachedResponse(request)
            .then((cached) => cached || caches.match('/'))
            .then((r) => r || new Response('Offline', { status: 503, statusText: 'Service Unavailable' }))
        )
    )
    return
  }

  // Static assets: stale-while-revalidate
  event.respondWith(
    matchCachedResponse(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (isCacheableStaticRequest(request, url)) {
            event.waitUntil(cachePutSafe(request, response))
          }
          return response
        })
        .catch(() => cached)

      return Promise.resolve(cached || networkFetch)
        .then((r) => r || new Response('Not Found', { status: 404 }))
    })
  )
})
