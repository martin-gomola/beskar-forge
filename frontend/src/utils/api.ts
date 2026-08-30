/**
 * Single source of truth for the API base URL.
 *
 * Why this exists: on a self-hosted nginx-proxied Docker deploy, the
 * frontend and backend share an origin and `fetch('/api/...')` works.
 * On a Render-style split deploy, the static site and the API live on
 * different hostnames and a raw `fetch('/api/...')` silently hits the
 * static site (404). Use `apiUrl()` (or build your axios baseURL from
 * `API_BASE_URL`) for every call to avoid that trap.
 *
 * Resolution order:
 *   1. `VITE_API_URL` at build time (Render, any split deploy).
 *   2. `http://localhost:8065` when running on localhost (dev).
 *   3. Empty string -> same-origin (self-hosted nginx-proxied Docker).
 *
 * See docs/RENDER.md ("The relative-fetch trap").
 */
const stripTrailingSlash = (url: string): string => url.replace(/\/+$/, '')

function resolveBaseUrl(): string {
  const buildTimeUrl = import.meta.env.VITE_API_URL
  if (buildTimeUrl) return stripTrailingSlash(buildTimeUrl)

  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8065'
    }
  }

  return ''
}

export const API_BASE_URL = resolveBaseUrl()

export const BACKEND_WAKING_EVENT = 'backend-waking'
export const BACKEND_READY_EVENT = 'backend-ready'

const RETRYABLE_STATUSES = new Set([502, 503, 504])
const MAX_RETRIES = 6
const BASE_DELAY_MS = 1500
const MAX_DELAY_MS = 8000
const WAKING_THRESHOLD_MS = 2000

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

let wakingActive = false

function emitWaking(): void {
  if (wakingActive || typeof window === 'undefined') return
  wakingActive = true
  window.dispatchEvent(new Event(BACKEND_WAKING_EVENT))
}

function emitReady(): void {
  if (!wakingActive || typeof window === 'undefined') return
  wakingActive = false
  window.dispatchEvent(new Event(BACKEND_READY_EVENT))
}

function isRetryableRequest(path: string, init: RequestInit | undefined): boolean {
  const method = (init?.method ?? 'GET').toUpperCase()
  return method === 'GET' && !path.includes('/health')
}

/**
 * Build an absolute API URL from a path like `/api/health`.
 * Accepts paths with or without a leading slash.
 */
export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalized}`
}

/**
 * Fetch an API resource and transparently retry transient Render wake-up
 * failures. Only GET requests are retried so future mutations are never
 * repeated automatically.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const retryable = isRetryableRequest(path, init)
  const startedAt = Date.now()
  let retryCount = 0

  while (true) {
    if (init?.signal?.aborted) {
      emitReady()
      throw new DOMException('The request was aborted.', 'AbortError')
    }

    try {
      const response = await fetch(apiUrl(path), init)
      const transientFailure = retryable && RETRYABLE_STATUSES.has(response.status)

      if (!transientFailure || retryCount >= MAX_RETRIES) {
        emitReady()
        return response
      }

      retryCount += 1
    } catch (error) {
      if (!retryable || init?.signal?.aborted || retryCount >= MAX_RETRIES) {
        emitReady()
        throw error
      }

      retryCount += 1
    }

    if (Date.now() - startedAt >= WAKING_THRESHOLD_MS) emitWaking()
    const delay = Math.min(BASE_DELAY_MS * 2 ** (retryCount - 1), MAX_DELAY_MS)
    await sleep(delay)
  }
}
