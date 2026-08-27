import { useCallback, useEffect, useRef, useState } from 'react'

export type UpdateCheckResult = 'current' | 'update-found' | 'unavailable'

function waitForInstallingWorker(registration: ServiceWorkerRegistration) {
  const worker = registration.installing
  if (!worker || worker.state !== 'installing') return Promise.resolve()

  return new Promise<void>((resolve) => {
    let timeoutId = 0

    const settle = () => {
      window.clearTimeout(timeoutId)
      worker.removeEventListener('statechange', onStateChange)
      resolve()
    }

    const onStateChange = () => {
      if (worker.state === 'installing') return
      settle()
    }

    worker.addEventListener('statechange', onStateChange)
    timeoutId = window.setTimeout(settle, 10_000)
  })
}

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const hasReloaded = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let cancelled = false
    let registration: ServiceWorkerRegistration | null = null
    let hasController = Boolean(navigator.serviceWorker.controller)

    const showWaitingWorker = (worker: ServiceWorker | null) => {
      if (worker && hasController && !cancelled) setWaitingWorker(worker)
    }

    const onInstallingStateChange = (worker: ServiceWorker) => {
      if (worker.state === 'installed') {
        showWaitingWorker(registration?.waiting ?? worker)
      }
    }

    const onUpdateFound = () => {
      const worker = registration?.installing
      if (!worker) return
      const onStateChange = () => {
        onInstallingStateChange(worker)
        if (worker.state === 'installed' || worker.state === 'redundant') {
          worker.removeEventListener('statechange', onStateChange)
        }
      }
      worker.addEventListener('statechange', onStateChange)
      onStateChange()
    }

    const onControllerChange = () => {
      if (hasController && !hasReloaded.current) {
        hasReloaded.current = true
        window.location.reload()
      }
      hasController = true
    }

    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    void navigator.serviceWorker.ready.then((readyRegistration) => {
      if (cancelled) return
      registration = readyRegistration
      showWaitingWorker(registration.waiting)
      registration.addEventListener('updatefound', onUpdateFound)
      if (registration.installing) onUpdateFound()
    })

    return () => {
      cancelled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      registration?.removeEventListener('updatefound', onUpdateFound)
    }
  }, [])

  const applyUpdate = useCallback(() => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' })
  }, [waitingWorker])

  const checkForUpdate = useCallback(async (): Promise<UpdateCheckResult> => {
    if (!('serviceWorker' in navigator)) {
      return 'unavailable'
    }

    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return 'unavailable'
    }

    if (registration.waiting && navigator.serviceWorker.controller) {
      setWaitingWorker(registration.waiting)
      return 'update-found'
    }

    await registration.update()
    await waitForInstallingWorker(registration)
    if (registration.waiting && navigator.serviceWorker.controller) {
      setWaitingWorker(registration.waiting)
      return 'update-found'
    }
    return 'current'
  }, [])

  return {
    updateAvailable: waitingWorker !== null,
    applyUpdate,
    checkForUpdate,
  }
}
