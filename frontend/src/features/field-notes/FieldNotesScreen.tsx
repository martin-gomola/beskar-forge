import { type FormEvent } from 'react'

import { useFieldNotesSession } from './useFieldNotesSession'

export function FieldNotesScreen() {
  const {
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
  } = useFieldNotesSession()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save()
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

        <form className="field-note-form" onSubmit={handleSubmit}>
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
            {editingNote && <button type="button" className="button-secondary" onClick={cancelEditing}>Cancel</button>}
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
                    <button type="button" className="button-secondary" onClick={() => void useServer(note)}>Use server copy</button>
                    <button type="button" className="button-primary" onClick={() => void keepLocal(note)}>Keep my changes</button>
                  </div>
                </div>
              )}
              {note.syncState !== 'conflict' && (
                <div className="field-note-actions">
                  <button type="button" className="text-button" onClick={() => startEditing(note)}>Edit</button>
                  <button type="button" className="text-button text-button-danger" onClick={() => void deleteNote(note)}>Delete</button>
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
