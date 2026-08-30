export type NotificationPermissionState = NotificationPermission | 'unsupported'

function notificationApi(): typeof Notification | null {
  if (typeof window === 'undefined' || !window.isSecureContext || !('Notification' in window)) return null
  return window.Notification
}

export function getNotificationPermission(): NotificationPermissionState {
  return notificationApi()?.permission ?? 'unsupported'
}

/** Request only from an explicit user action; never call this during startup. */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  const api = notificationApi()
  if (!api) return 'unsupported'
  if (api.permission !== 'default') return api.permission
  return api.requestPermission()
}

export async function showAppNotification(
  title: string,
  options?: NotificationOptions,
): Promise<boolean> {
  const api = notificationApi()
  if (!api || api.permission !== 'granted') return false

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration()
    if (registration && typeof registration.showNotification === 'function') {
      await registration.showNotification(title, options)
      return true
    }
  }

  new api(title, options)
  return true
}
