import { useState } from 'react'

import { StarterScreen } from './components/StarterScreen'
import { PLATFORM_NAME, PLATFORM_STACK_LABEL } from './config/platform'
import { BackendWakingOverlay, useToast } from './components/common'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate'
import { APP_VERSION } from './utils/version'

function App() {
  useDocumentTitle(PLATFORM_NAME)
  const { updateAvailable, applyUpdate, checkForUpdate } = useServiceWorkerUpdate()
  const { showToast } = useToast()
  const [checkingForUpdate, setCheckingForUpdate] = useState(false)

  async function handleUpdateAction() {
    if (updateAvailable) {
      applyUpdate()
      return
    }

    setCheckingForUpdate(true)
    try {
      const result = await checkForUpdate()
      if (result === 'unavailable') {
        showToast('Update checks are unavailable right now.', 'info')
      } else if (result === 'current') {
        showToast('You already have the latest version.', 'success')
      } else {
        showToast('Update ready. Choose Update now to install it.', 'info')
      }
    } catch {
      showToast('Update check failed. Try again in a moment.', 'error')
    } finally {
      setCheckingForUpdate(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface text-[#1f3326]">
      {/* New version banner. pt-[max(env(safe-area-inset-top),0.5rem)] keeps
          the banner clear of the notch / Dynamic Island when this app is
          installed as a PWA on iPhone. Body padding can't push fixed
          elements, so each fixed element handles its own safe-area inset. */}
      {updateAvailable && (
        <div className="fixed top-0 inset-x-0 z-50 bg-accent-700 text-white text-center px-4 pb-2 text-sm flex items-center justify-center gap-3 pt-[max(env(safe-area-inset-top),0.5rem)] shadow-lg">
          <span>A new version is available</span>
          <button
            onClick={applyUpdate}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
          >
            Update now
          </button>
        </div>
      )}

      <BackendWakingOverlay />
      <StarterScreen />

      <div className="starter-footer">
        <span>{PLATFORM_STACK_LABEL}</span>
        <span>v{APP_VERSION}</span>
        <button
          type="button"
          onClick={() => void handleUpdateAction()}
          disabled={checkingForUpdate}
        >
          {updateAvailable
            ? 'Update now'
            : checkingForUpdate
              ? 'Checking…'
              : 'Check for updates'}
        </button>
      </div>
    </div>
  )
}

export default App
