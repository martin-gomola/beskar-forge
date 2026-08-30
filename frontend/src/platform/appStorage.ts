/**
 * Shared storage lifecycle for apps built from Beskar Forge.
 *
 * Keep application keys under APP_STORAGE_PREFIX and list every app-owned
 * IndexedDB database when calling clearAppData. Browser permissions and the
 * service-worker app shell are intentionally outside this data boundary.
 */
export const APP_STORAGE_PREFIX = 'beskar-forge:'

let appDataClearInProgress = false

function defaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isAppDataClearInProgress(): boolean {
  return appDataClearInProgress
}

export function clearNamespacedLocalStorage(
  storage: Storage | null = defaultStorage(),
  prefixes: readonly string[] = [APP_STORAGE_PREFIX],
): void {
  if (!storage) return

  const keysToRemove: string[] = []
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => storage.removeItem(key))
}

export function deleteIndexedDbDatabase(databaseName: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return Promise.resolve()

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error ?? new Error(`Could not clear ${databaseName}.`))
    request.onblocked = () => reject(new Error(`Could not clear ${databaseName}: storage is open in another tab.`))
  })
}

export async function clearAppData(options: {
  storage?: Storage | null
  localStoragePrefixes?: readonly string[]
  indexedDbNames?: readonly string[]
} = {}): Promise<void> {
  appDataClearInProgress = true
  try {
    clearNamespacedLocalStorage(options.storage, options.localStoragePrefixes)
    await Promise.all((options.indexedDbNames ?? []).map(deleteIndexedDbDatabase))
  } catch (error) {
    appDataClearInProgress = false
    throw error
  }
  // Keep the guard active until the caller reloads. A pagehide save during
  // that reload must not recreate the data that was just deleted.
}
