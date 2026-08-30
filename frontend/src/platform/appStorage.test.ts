import { describe, expect, it } from 'vitest'

import { clearNamespacedLocalStorage } from './appStorage'

describe('clearNamespacedLocalStorage', () => {
  it('removes only app-owned keys', () => {
    const values = new Map([
      ['beskar-forge:preferences', 'saved preferences'],
      ['beskar-forge:feature-cache', 'saved feature data'],
      ['other-app:setting', 'keep me'],
    ])
    const storage = {
      get length() { return values.size },
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => { values.delete(key) },
    } as unknown as Storage

    clearNamespacedLocalStorage(storage)

    expect([...values.entries()]).toEqual([['other-app:setting', 'keep me']])
  })
})
