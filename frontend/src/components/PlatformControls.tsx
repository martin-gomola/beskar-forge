import { useState } from 'react'

import { clearAppData } from '../platform/appStorage'
import {
  getNotificationPermission,
  requestNotificationPermission,
  showAppNotification,
  type NotificationPermissionState,
} from '../platform/notifications'

interface PlatformControlsProps {
  indexedDbNames: readonly string[]
}

export function PlatformControls({ indexedDbNames }: PlatformControlsProps) {
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermissionState>(getNotificationPermission)
  const [notificationMessage, setNotificationMessage] = useState('')

  async function clearSavedData() {
    if (clearing) return
    if (!window.confirm('Delete this app’s saved data from this device? This cannot be undone.')) return

    setClearing(true)
    setClearError(null)
    try {
      await clearAppData({ indexedDbNames })
      window.location.reload()
    } catch {
      setClearing(false)
      setClearError('The saved data could not be cleared. Close other tabs of this app and try again.')
    }
  }

  async function enableNotifications() {
    setNotificationMessage('')
    const nextPermission = await requestNotificationPermission()
    setNotificationPermission(nextPermission)

    if (nextPermission === 'granted') {
      try {
        const shown = await showAppNotification('Notifications enabled', {
          body: 'This app can now notify you when a feature needs your attention.',
        })
        setNotificationMessage(shown
          ? 'Notification requested. Check your system notification center if it does not appear.'
          : 'Notifications are not available in this app window.')
      } catch {
        setNotificationMessage('Permission was granted, but the test notification could not be shown.')
      }
    } else if (nextPermission === 'denied') {
      setNotificationMessage('Notifications are blocked. Enable them in the device settings.')
    } else if (nextPermission === 'unsupported') {
      setNotificationMessage('Notifications require HTTPS and a supported browser. On iPhone, install this app to the Home Screen first.')
    }
  }

  return (
    <section className="platform-controls" aria-labelledby="platform-controls-title">
      <div>
        <p className="step-label">Device controls</p>
        <h2 id="platform-controls-title">App settings</h2>
        <p>These controls belong to the app shell and can stay when you replace the example feature.</p>
      </div>
      <div className="platform-control-group">
        <div>
          <strong>Notifications</strong>
          <p role="status" aria-live="polite">
            {notificationMessage || (notificationPermission === 'granted'
              ? 'Notifications are enabled.'
              : notificationPermission === 'denied'
                ? 'Notifications are blocked in device settings.'
                : notificationPermission === 'unsupported'
                  ? 'Notifications are not available in this browser or context.'
                  : 'Enable notifications only when your feature needs them.')}
          </p>
        </div>
        {notificationPermission !== 'denied' && notificationPermission !== 'unsupported' && (
          <button type="button" className="button-secondary" onClick={() => void enableNotifications()}>
            {notificationPermission === 'granted' ? 'Send test notification' : 'Enable notifications'}
          </button>
        )}
      </div>
      <div className="platform-control-group platform-control-danger">
        <div>
          <strong>Saved data</strong>
          <p>Deletes this app’s namespaced localStorage and registered IndexedDB data. It does not remove server data, the app shell, or notification permission.</p>
        </div>
        <button type="button" className="button-danger" disabled={clearing} onClick={() => void clearSavedData()}>
          {clearing ? 'Clearing…' : 'Clear saved data'}
        </button>
      </div>
      {clearError && <p className="platform-control-error" role="alert">{clearError}</p>}
    </section>
  )
}
