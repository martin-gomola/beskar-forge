import { apiFetch } from '../../utils/api'
import { isAppDataClearInProgress } from '../../platform'

export type SyncState = 'synced' | 'pending' | 'conflict'

export interface FieldNote {
  id: string
  title: string
  details: string
  createdAt: string
  updatedAt: string
  version: number
  deletedAt: string | null
  syncState: SyncState
  conflictNote?: FieldNote
  conflictMessage?: string
}

export interface FieldNotesAdapter {
  loadNotes: () => Promise<FieldNote[]>
  loadPendingCount: () => Promise<number>
  saveNote: (note: FieldNote, baseVersion: number | null) => Promise<void>
  deleteNote: (note: FieldNote) => Promise<void>
  keepLocal: (note: FieldNote) => Promise<void>
  useServer: (note: FieldNote) => Promise<void>
  sync: () => Promise<{ conflicts: number }>
}

interface StoredMutation {
  mutationId: string
  noteId: string
  operation: 'upsert' | 'delete'
  title: string
  details: string
  baseVersion: number | null
  clientUpdatedAt: string
}

interface SyncResponse {
  applied_mutation_ids: string[]
  duplicate_mutation_ids: string[]
  conflicts: Array<{
    mutation_id: string
    note: RemoteNote | null
    message: string
  }>
  records: RemoteNote[]
  next_cursor: number
}

interface RemoteNote {
  id: string
  title: string
  details: string
  created_at: string
  updated_at: string
  version: number
  deleted_at: string | null
}

interface MetaRecord {
  key: string
  value: string | number
}

export const FIELD_NOTES_DATABASE_NAME = 'beskar-forge-field-notes'
const DATABASE_VERSION = 1
const NOTES_STORE = 'notes'
const OUTBOX_STORE = 'outbox'
const META_STORE = 'meta'

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  if (isAppDataClearInProgress()) {
    return Promise.reject(new Error('Local data is being cleared.'))
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FIELD_NOTES_DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(NOTES_STORE)) {
        database.createObjectStore(NOTES_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: 'mutationId' })
      }
      if (!database.objectStoreNames.contains(META_STORE)) {
        database.createObjectStore(META_STORE, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open local field notes'))
  })
}

function toStoredNote(note: FieldNote): FieldNote {
  return { ...note }
}

function fromRemoteNote(note: RemoteNote, syncState: SyncState = 'synced'): FieldNote {
  return {
    id: note.id,
    title: note.title,
    details: note.details,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    version: note.version,
    deletedAt: note.deleted_at,
    syncState,
  }
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(storeName, 'readonly')
    return await requestResult(transaction.objectStore(storeName).getAll()) as T[]
  } finally {
    database.close()
  }
}

async function getMeta<T extends string | number>(key: string): Promise<T | undefined> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(META_STORE, 'readonly')
    const record = await requestResult(transaction.objectStore(META_STORE).get(key)) as MetaRecord | undefined
    return record?.value as T | undefined
  } finally {
    database.close()
  }
}

async function putMeta(key: string, value: string | number): Promise<void> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(META_STORE, 'readwrite')
    transaction.objectStore(META_STORE).put({ key, value } satisfies MetaRecord)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

async function loadLocalNotes(): Promise<FieldNote[]> {
  const notes = await getAll<FieldNote>(NOTES_STORE)
  return notes
    .filter((note) => !note.deletedAt)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

async function loadPendingMutations(): Promise<StoredMutation[]> {
  return getAll<StoredMutation>(OUTBOX_STORE)
}

async function getSyncCursor(): Promise<number> {
  return (await getMeta<number>('syncCursor')) ?? 0
}

async function getDeviceId(): Promise<string> {
  const storedDeviceId = await getMeta<string>('deviceId')
  if (storedDeviceId) return storedDeviceId

  const deviceId = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
  await putMeta('deviceId', deviceId)
  return deviceId
}

async function saveLocalNote(note: FieldNote, baseVersion: number | null): Promise<void> {
  const existingMutations = await loadPendingMutations()
  const database = await openDatabase()
  try {
    const transaction = database.transaction([NOTES_STORE, OUTBOX_STORE], 'readwrite')
    const notes = transaction.objectStore(NOTES_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    existingMutations
      .filter((mutation) => mutation.noteId === note.id)
      .forEach((mutation) => outbox.delete(mutation.mutationId))

    notes.put(toStoredNote({ ...note, syncState: 'pending', conflictNote: undefined, conflictMessage: undefined }))
    outbox.put({
      mutationId: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      noteId: note.id,
      operation: 'upsert',
      title: note.title,
      details: note.details,
      baseVersion,
      clientUpdatedAt: new Date().toISOString(),
    } satisfies StoredMutation)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

async function deleteLocalNote(note: FieldNote): Promise<void> {
  const existingMutations = await loadPendingMutations()
  const database = await openDatabase()
  try {
    const transaction = database.transaction([NOTES_STORE, OUTBOX_STORE], 'readwrite')
    const notes = transaction.objectStore(NOTES_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    existingMutations
      .filter((mutation) => mutation.noteId === note.id)
      .forEach((mutation) => outbox.delete(mutation.mutationId))

    notes.put({
      ...note,
      deletedAt: new Date().toISOString(),
      syncState: 'pending',
      conflictNote: undefined,
      conflictMessage: undefined,
    } satisfies FieldNote)
    outbox.put({
      mutationId: typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      noteId: note.id,
      operation: 'delete',
      title: '',
      details: '',
      baseVersion: note.version || null,
      clientUpdatedAt: new Date().toISOString(),
    } satisfies StoredMutation)
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

async function applySyncResponse(response: SyncResponse): Promise<void> {
  const [pending, localNotes] = await Promise.all([
    loadPendingMutations(),
    getAll<FieldNote>(NOTES_STORE),
  ])
  const localNotesById = new Map(localNotes.map((note) => [note.id, note]))
  const completedMutationIds = new Set([
    ...response.applied_mutation_ids,
    ...response.duplicate_mutation_ids,
  ])
  const conflictsByMutationId = new Map(
    response.conflicts.map((conflict) => [conflict.mutation_id, conflict]),
  )
  const database = await openDatabase()
  try {
    const transaction = database.transaction([NOTES_STORE, OUTBOX_STORE], 'readwrite')
    const notes = transaction.objectStore(NOTES_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)

    completedMutationIds.forEach((mutationId) => outbox.delete(mutationId))
    response.records.forEach((remoteNote) => {
      if (remoteNote.deleted_at) {
        notes.delete(remoteNote.id)
      } else {
        notes.put(fromRemoteNote(remoteNote))
      }
    })

    pending.forEach((mutation) => {
      const conflict = conflictsByMutationId.get(mutation.mutationId)
      if (!conflict || !conflict.note) return
      const remoteNote = conflict.note
      const localNote = localNotesById.get(mutation.noteId)
      if (!localNote) return
      notes.put({
        ...localNote,
        syncState: 'conflict',
        conflictNote: fromRemoteNote(remoteNote),
        conflictMessage: conflict.message,
      } satisfies FieldNote)
    })
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
  await putMeta('syncCursor', response.next_cursor)
}

async function resolveConflictKeepLocal(note: FieldNote): Promise<void> {
  if (!note.conflictNote) return
  await saveLocalNote(note, note.conflictNote.version)
}

async function resolveConflictUseServer(note: FieldNote): Promise<void> {
  if (!note.conflictNote) return
  const mutations = await loadPendingMutations()
  const database = await openDatabase()
  try {
    const transaction = database.transaction([NOTES_STORE, OUTBOX_STORE], 'readwrite')
    const notes = transaction.objectStore(NOTES_STORE)
    const outbox = transaction.objectStore(OUTBOX_STORE)
    mutations
      .filter((mutation) => mutation.noteId === note.id)
      .forEach((mutation) => outbox.delete(mutation.mutationId))
    notes.put(fromRemoteNote({
      id: note.conflictNote.id,
      title: note.conflictNote.title,
      details: note.conflictNote.details,
      created_at: note.conflictNote.createdAt,
      updated_at: note.conflictNote.updatedAt,
      version: note.conflictNote.version,
      deleted_at: note.conflictNote.deletedAt,
    }))
    await transactionComplete(transaction)
  } finally {
    database.close()
  }
}

async function syncLocalNotes(): Promise<{ conflicts: number }> {
  const [deviceId, cursor, mutations] = await Promise.all([
    getDeviceId(),
    getSyncCursor(),
    loadPendingMutations(),
  ])
  const response = await apiFetch('/api/field-notes/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: deviceId,
      cursor,
      mutations: mutations.map((mutation) => ({
        mutation_id: mutation.mutationId,
        note_id: mutation.noteId,
        operation: mutation.operation,
        title: mutation.title,
        details: mutation.details,
        base_version: mutation.baseVersion,
        client_updated_at: mutation.clientUpdatedAt,
      })),
    }),
  })
  if (!response.ok) throw new Error(`Sync failed with ${response.status}`)
  const result = await response.json() as SyncResponse
  await applySyncResponse(result)
  return { conflicts: result.conflicts.length }
}

export const fieldNotesAdapter: FieldNotesAdapter = {
  loadNotes: loadLocalNotes,
  loadPendingCount: async () => (await loadPendingMutations()).length,
  saveNote: saveLocalNote,
  deleteNote: deleteLocalNote,
  keepLocal: resolveConflictKeepLocal,
  useServer: resolveConflictUseServer,
  sync: syncLocalNotes,
}
