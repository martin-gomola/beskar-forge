import { useEffect, useState } from 'react'

import {
  applyWaitingUpdate,
  checkForUpdate,
  subscribeToUpdateLifecycle,
} from '../platform/updateLifecycle'

export type { UpdateCheckResult } from '../platform/updateLifecycle'

export function useServiceWorkerUpdate() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    return subscribeToUpdateLifecycle(setWaitingWorker)
  }, [])

  return {
    updateAvailable: waitingWorker !== null,
    applyUpdate: applyWaitingUpdate,
    checkForUpdate,
  }
}
