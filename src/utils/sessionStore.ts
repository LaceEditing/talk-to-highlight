import type { ParsedDoc } from './docParser'

const SESSIONS_KEY = 'tth-sessions'
const MAX_SESSIONS = 20

/**
 * Schema version — bump this when the SavedSession shape changes.
 * The migrate() function below handles upgrading old data.
 */
const SCHEMA_VERSION = 2

export interface SavedSession {
  id: string
  title: string
  doc: ParsedDoc
  highlightedUpTo: number
  lastAccessed: number // epoch ms
  wordCount: number
}

interface StorageEnvelope {
  version: number
  sessions: SavedSession[]
}

/** Deterministic ID from document content (first 200 chars of words + title) */
function generateSessionId(doc: ParsedDoc): string {
  const source = doc.title + '|' + doc.words.slice(0, 40).map(w => w.normalized).join(' ')
  // Simple hash — no crypto needed, just a stable key
  let hash = 0
  for (let i = 0; i < source.length; i++) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0
  }
  return 'sess_' + (hash >>> 0).toString(36)
}

/**
 * Migrate data from older schema versions to current.
 * Each case falls through so migrations are cumulative.
 */
function migrate(raw: unknown): StorageEnvelope {
  // v1 / unversioned: raw was a plain SavedSession[]
  if (Array.isArray(raw)) {
    return { version: SCHEMA_VERSION, sessions: raw as SavedSession[] }
  }

  const envelope = raw as Partial<StorageEnvelope>
  const version = envelope.version ?? 1
  const sessions = envelope.sessions ?? []

  // Future migrations go here, e.g.:
  // if (version < 3) { sessions = sessions.map(s => ({ ...s, newField: defaultVal })) }
  void version // acknowledge for future use

  return { version: SCHEMA_VERSION, sessions }
}

function loadAll(): SavedSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const envelope = migrate(parsed)
    // Re-save if we migrated from an older version
    if (
      !(parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
        (parsed as StorageEnvelope).version === SCHEMA_VERSION)
    ) {
      saveAll(envelope.sessions)
    }
    return envelope.sessions
  } catch {
    return []
  }
}

function saveAll(sessions: SavedSession[]) {
  try {
    const envelope: StorageEnvelope = { version: SCHEMA_VERSION, sessions }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(envelope))
  } catch { /* storage full — non-critical */ }
}

/** Save or update a session for the given document and progress */
export function saveSession(doc: ParsedDoc, highlightedUpTo: number) {
  const id = generateSessionId(doc)
  const sessions = loadAll()
  const existing = sessions.findIndex(s => s.id === id)

  const entry: SavedSession = {
    id,
    title: doc.title,
    doc,
    highlightedUpTo,
    lastAccessed: Date.now(),
    wordCount: doc.words.length,
  }

  if (existing !== -1) {
    sessions[existing] = entry
  } else {
    sessions.unshift(entry)
    // Evict oldest sessions if over the limit
    if (sessions.length > MAX_SESSIONS) {
      sessions.sort((a, b) => b.lastAccessed - a.lastAccessed)
      sessions.length = MAX_SESSIONS
    }
  }

  saveAll(sessions)
}

/** Get all saved sessions, most recent first */
export function getSessions(): SavedSession[] {
  return loadAll().sort((a, b) => b.lastAccessed - a.lastAccessed)
}

/** Delete a single session by ID */
export function deleteSession(id: string) {
  const sessions = loadAll().filter(s => s.id !== id)
  saveAll(sessions)
}

/** Get the session ID for a given doc (used to load progress) */
export function getSessionForDoc(doc: ParsedDoc): SavedSession | undefined {
  const id = generateSessionId(doc)
  return loadAll().find(s => s.id === id)
}

// Clean up old single-doc keys from previous implementation
try {
  localStorage.removeItem('tth-saved-doc')
  localStorage.removeItem('tth-saved-progress')
} catch { /* */ }
