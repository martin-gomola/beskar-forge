import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  fieldNotesAdapter,
  type FieldNote,
  type FieldNotesAdapter,
} from './fieldNotesStore'

type ScreenState = 'loading' | 'ready' | 'error'

function makeId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function useFieldNotesSession(adapter: FieldNotesAdapter = fieldNotesAdapter) {
  const [notes, setNotes] = useState<FieldNote[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [screenState, setScreenState] = useState<ScreenState>('loading')
  const [online, setOnline] = useState(() => navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSyncMessage, setLastSyncMessage] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')

  const editingNote = useMemo(
    () => notes.find((note) => note.id === editingNoteId) ?? null,
    [editingNoteId, notes],
  )

  const refresh = useCallback(async () => {
    const [localNotes, nextPendingCount] = await Promise.all([
      adapter.loadNotes(),
      adapter.loadPendingCount(),
    ])
    setNotes(localNotes)
    setPendingCount(nextPendingCount)
    setScreenState('ready')
  }, [adapter])

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      await refresh()
      setLastSyncMessage('Working offline. Changes stay on this device.')
      return
    }

    setSyncing(true)
    setErrorMessage(null)
    try {
      const result = await adapter.sync()
      await refresh()
      setLastSyncMessage(
        result.conflicts > 0
          ? `${result.conflicts} change needs your review.`
          : 'All changes synced.',
      )
    } catch {
      await refresh()
      setErrorMessage('Could not reach the server. Your local changes are safe and queued.')
      setLastSyncMessage('Waiting to sync when a connection returns.')
    } finally {
      setSyncing(false)
    }
  }, [adapter, refresh])

  useEffect(() => {
    let mounted = true
    void (async () => {
      try {
        await refresh()
        if (mounted && navigator.onLine) await sync()
      } catch {
        if (mounted) {
          setScreenState('error')
          setErrorMessage('Local storage is unavailable in this browser.')
        }
      }
    })()
    return () => {
      mounted = false
    }
  }, [refresh, sync])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      void sync()
    }
    const handleOffline = () => {
      setOnline(false)
      setLastSyncMessage('Working offline. Changes stay on this device.')
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void sync()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [sync])

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null)
    setTitle('')
    setDetails('')
  }, [])

  const startEditing = useCallback((note: FieldNote) => {
    setEditingNoteId(note.id)
    setTitle(note.title)
    setDetails(note.details)
  }, [])

  const save = useCallback(async () => {
    const cleanTitle = title.trim()
    const cleanDetails = details.trim()
    if (!cleanTitle) return

    const now = new Date().toISOString()
    const note: FieldNote = editingNote
      ? {
          ...editingNote,
          title: cleanTitle,
          details: cleanDetails,
          updatedAt: now,
          deletedAt: null,
        }
      : {
          id: makeId(),
          title: cleanTitle,
          details: cleanDetails,
          createdAt: now,
          updatedAt: now,
          version: 0,
          deletedAt: null,
          syncState: 'pending',
        }

    await adapter.saveNote(note, editingNote ? editingNote.version : null)
    cancelEditing()
    await refresh()
    if (navigator.onLine) void sync()
  }, [adapter, cancelEditing, editingNote, refresh, sync, title, details])

  const deleteNote = useCallback(async (note: FieldNote) => {
    await adapter.deleteNote(note)
    await refresh()
    if (navigator.onLine) void sync()
  }, [adapter, refresh, sync])

  const keepLocal = useCallback(async (note: FieldNote) => {
    await adapter.keepLocal(note)
    await refresh()
    if (navigator.onLine) void sync()
  }, [adapter, refresh, sync])

  const useServer = useCallback(async (note: FieldNote) => {
    await adapter.useServer(note)
    await refresh()
  }, [adapter, refresh])

  return {
    notes,
    pendingCount,
    screenState,
    online,
    syncing,
    errorMessage,
    lastSyncMessage,
    editingNote,
    title,
    details,
    setTitle,
    setDetails,
    sync,
    save,
    startEditing,
    cancelEditing,
    deleteNote,
    keepLocal,
    useServer,
  }
}
