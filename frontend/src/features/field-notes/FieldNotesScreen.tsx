import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  deleteLocalNote,
  loadLocalNotes,
  loadPendingMutations,
  resolveConflictKeepLocal,
  resolveConflictUseServer,
  saveLocalNote,
  syncLocalNotes,
  type FieldNote,
} from './fieldNotesStore'

type ScreenState = 'loading' | 'ready' | 'error'

function makeId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `note-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function FieldNotesScreen() {
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
    const [localNotes, pendingMutations] = await Promise.all([
      loadLocalNotes(),
      loadPendingMutations(),
    ])
    setNotes(localNotes)
    setPendingCount(pendingMutations.length)
    setScreenState('ready')
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      await refresh()
      setLastSyncMessage('Working offline. Changes stay on this device.')
      return
    }

    setSyncing(true)
    setErrorMessage(null)
    try {
      const result = await syncLocalNotes()
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
  }, [refresh])

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

  function resetForm() {
    setEditingNoteId(null)
    setTitle('')
    setDetails('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
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

    await saveLocalNote(note, editingNote ? editingNote.version : null)
    resetForm()
    await refresh()
    if (navigator.onLine) void sync()
  }

  async function handleDelete(note: FieldNote) {
    await deleteLocalNote(note)
    await refresh()
    if (navigator.onLine) void sync()
  }

  async function handleKeepLocal(note: FieldNote) {
    await resolveConflictKeepLocal(note)
    await refresh()
    if (navigator.onLine) void sync()
  }

  async function handleUseServer(note: FieldNote) {
    await resolveConflictUseServer(note)
    await refresh()
  }

  if (screenState === 'loading') {
    return <main className="field-notes-shell"><p className="field-notes-loading">Opening your local field notebook…</p></main>
  }

  return (
    <main className="field-notes-shell">
      <header className="field-notes-header">
        <div className="field-notes-brand">
          <img className="starter-mark" src="/icon-192.png" alt="" />
          <div>
            <p className="eyebrow">Offline field notebook</p>
            <h1>Field Notes</h1>
            <p className="starter-tagline">Capture observations now. Sync them when the signal returns.</p>
          </div>
        </div>
        <div className={`sync-status ${online ? 'sync-status-online' : 'sync-status-offline'}`} role="status">
          <span className="health-dot" aria-hidden="true" />
          {online ? (syncing ? 'Syncing' : 'Online') : 'Offline'}
        </div>
      </header>

      <section className="field-notes-panel" aria-labelledby="capture-title">
        <div className="field-notes-panel-heading">
          <div>
            <p className="step-label">Capture locally</p>
            <h2 id="capture-title">Record an observation</h2>
          </div>
          {pendingCount > 0 && <span className="queue-count">{pendingCount} queued</span>}
        </div>
        <p className="field-notes-description">
          Your note is saved on this device before we try the network. You can keep working with no signal.
        </p>

        <form className="field-note-form" onSubmit={(event) => void handleSubmit(event)}>
          <label>
            <span>Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. North gate inspection"
              maxLength={120}
              required
            />
          </label>
          <label>
            <span>Details</span>
            <textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="What did you see? What needs follow-up?"
              maxLength={4000}
              rows={4}
            />
          </label>
          <div className="field-note-form-actions">
            {editingNote && <button type="button" className="button-secondary" onClick={resetForm}>Cancel</button>}
            <button type="submit" className="button-primary">{editingNote ? 'Save changes' : 'Save note'}</button>
          </div>
        </form>

        <div className="sync-message" role="status" aria-live="polite">
          <span className={`sync-message-dot ${online ? 'sync-message-dot-online' : 'sync-message-dot-offline'}`} aria-hidden="true" />
          <span>{lastSyncMessage || (online ? 'Ready to sync.' : 'Offline mode is active.')}</span>
          <button type="button" className="sync-button" onClick={() => void sync()} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
        {errorMessage && <p className="field-notes-error" role="alert">{errorMessage}</p>}
      </section>

      <section className="field-notes-list" aria-labelledby="notes-title">
        <div className="field-notes-list-heading">
          <div>
            <p className="step-label">On this device</p>
            <h2 id="notes-title">Recent observations</h2>
          </div>
          <span className="note-count">{notes.length}</span>
        </div>

        {notes.length === 0 && <p className="empty-notes">No observations yet. Your first note will be available offline.</p>}
        <div className="field-note-cards">
          {notes.map((note) => (
            <article className={`field-note-card field-note-card-${note.syncState}`} key={note.id}>
              <div className="field-note-card-heading">
                <div>
                  <h3>{note.title}</h3>
                  <p>{new Date(note.updatedAt).toLocaleString()}</p>
                </div>
                <span className="note-state">
                  {note.syncState === 'conflict' && 'Needs review'}
                  {note.syncState === 'pending' && 'Queued'}
                  {note.syncState === 'synced' && 'Synced'}
                </span>
              </div>
              {note.details && <p className="field-note-details">{note.details}</p>}
              {note.syncState === 'conflict' && note.conflictNote && (
                <div className="conflict-box">
                  <p>{note.conflictMessage} Server copy: “{note.conflictNote.title}”.</p>
                  <div className="conflict-actions">
                    <button type="button" className="button-secondary" onClick={() => void handleUseServer(note)}>Use server copy</button>
                    <button type="button" className="button-primary" onClick={() => void handleKeepLocal(note)}>Keep my changes</button>
                  </div>
                </div>
              )}
              {note.syncState !== 'conflict' && (
                <div className="field-note-actions">
                  <button type="button" className="text-button" onClick={() => { setEditingNoteId(note.id); setTitle(note.title); setDetails(note.details) }}>Edit</button>
                  <button type="button" className="text-button text-button-danger" onClick={() => void handleDelete(note)}>Delete</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <footer className="field-notes-footer">
        <span>Local-first PWA</span>
        <span>FastAPI sync</span>
        <span>Data stays on this device until synced</span>
      </footer>
    </main>
  )
}
