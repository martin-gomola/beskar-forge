import { useCallback, useEffect, useState } from 'react'

import {
  FULL_EXAMPLE_URL,
  PLATFORM_DESCRIPTION,
  PLATFORM_NAME,
  PLATFORM_TAGLINE,
} from '../config/platform'
import { apiFetch } from '../utils/api'

type HealthState = 'loading' | 'connected' | 'error'

interface HealthResponse {
  status: string
  service: string
  version: string
}

export function StarterScreen() {
  const [state, setState] = useState<HealthState>('loading')
  const [health, setHealth] = useState<HealthResponse | null>(null)

  const checkHealth = useCallback(async () => {
    setState('loading')

    try {
      const response = await apiFetch('/api/health')
      if (!response.ok) throw new Error(`Health check returned ${response.status}`)

      const result = (await response.json()) as HealthResponse
      setHealth(result)
      setState('connected')
    } catch {
      setHealth(null)
      setState('error')
    }
  }, [])

  useEffect(() => {
    void checkHealth()
  }, [checkHealth])

  return (
    <main className="starter-shell">
      <header className="starter-header">
        <img className="starter-mark" src="/icon-192.png" alt="" />
        <div>
          <p className="eyebrow">Minimal application starter</p>
          <h1>{PLATFORM_NAME}</h1>
          <p className="starter-tagline">{PLATFORM_TAGLINE}</p>
        </div>
      </header>

      <section className="starter-card" aria-labelledby="starter-title">
        <div className="starter-card-heading">
          <div>
            <p className="step-label">Ready to build</p>
            <h2 id="starter-title">Confirm the backend connection</h2>
          </div>
          <span className={`health-badge health-badge-${state}`} role="status">
            <span className="health-dot" aria-hidden="true" />
            {state === 'loading' && 'Checking API'}
            {state === 'connected' && 'Connected'}
            {state === 'error' && 'Connection failed'}
          </span>
        </div>

        <p className="starter-description">{PLATFORM_DESCRIPTION}</p>

        {state === 'loading' && (
          <div className="health-message" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <span>Checking the FastAPI backend…</span>
          </div>
        )}

        {state === 'connected' && health && (
          <div className="health-message health-message-success" role="status" aria-live="polite">
            <span className="health-icon" aria-hidden="true">✓</span>
            <span>
              {health.service} is healthy{health.version ? ` (v${health.version})` : ''}.
            </span>
          </div>
        )}

        {state === 'error' && (
          <div className="health-message health-message-error" role="alert">
            <span>
              The frontend could not reach the API. Check that the backend is running, then try
              again.
            </span>
            <button type="button" onClick={() => void checkHealth()}>
              Try again
            </button>
          </div>
        )}
      </section>

      <section className="starter-next-step" aria-labelledby="next-step-title">
        <p className="step-label">Next step</p>
        <h2 id="next-step-title">Build your first focused workflow</h2>
        <p>
          Replace this screen with your first feature while keeping the API helper, security
          defaults, Docker workflow, and PWA update flow.
        </p>
        <a href={FULL_EXAMPLE_URL} target="_blank" rel="noreferrer">
          See the full Garden Planner example <span aria-hidden="true">↗</span>
        </a>
      </section>
    </main>
  )
}
