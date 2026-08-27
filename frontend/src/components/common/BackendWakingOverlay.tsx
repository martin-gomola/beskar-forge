import { useEffect, useRef, useState } from 'react'

import { BACKEND_READY_EVENT, BACKEND_WAKING_EVENT } from '../../utils/api'

export function BackendWakingOverlay() {
  const [visible, setVisible] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startedAt = useRef<number | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    function handleWaking() {
      startedAt.current = Date.now()
      setElapsedSeconds(0)
      setVisible(true)

      if (timer.current === null) {
        timer.current = window.setInterval(() => {
          if (startedAt.current !== null) {
            setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000))
          }
        }, 500)
      }
    }

    function handleReady() {
      startedAt.current = null
      setVisible(false)
      if (timer.current !== null) {
        window.clearInterval(timer.current)
        timer.current = null
      }
    }

    window.addEventListener(BACKEND_WAKING_EVENT, handleWaking)
    window.addEventListener(BACKEND_READY_EVENT, handleReady)

    return () => {
      window.removeEventListener(BACKEND_WAKING_EVENT, handleWaking)
      window.removeEventListener(BACKEND_READY_EVENT, handleReady)
      if (timer.current !== null) window.clearInterval(timer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="backend-waking" role="status" aria-live="polite">
      <span className="backend-waking-spinner" aria-hidden="true" />
      <span>
        <strong>Waking the demo backend…</strong>
        <small>
          Render free tier may take about 30 seconds to start.
          {elapsedSeconds > 0 && ` (${elapsedSeconds}s)`}
        </small>
      </span>
    </div>
  )
}
