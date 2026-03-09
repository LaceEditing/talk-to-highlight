import { useCallback, useEffect, useRef, useState } from 'react'
import { useGoogleLogin } from '@react-oauth/google'
import { DocLoader } from './components/DocLoader'
import { Reader } from './components/Reader'
import { fetchAndParseDoc } from './utils/docParser'
import type { ParsedDoc } from './utils/docParser'
import { ThemePicker } from './components/ThemePicker'
import { getSessions, deleteSession } from './utils/sessionStore'
import type { SavedSession } from './utils/sessionStore'

type AppState =
  | { screen: 'idle' }
  | { screen: 'loading-doc'; docId: string; accessToken: string }
  | { screen: 'reading'; doc: ParsedDoc; accessToken?: string }
  | { screen: 'error'; message: string }

// Google Picker requires GAPI (loaded in index.html via a <script> tag)
declare const google: {
  picker: {
    PickerBuilder: new () => GooglePickerBuilder
    Action: { PICKED: string; CANCEL: string }
    ViewId: { DOCS: string }
    View: new (id: string) => GooglePickerView
  }
}
declare const gapi: {
  load: (lib: string, cb: () => void) => void
  client: { init: (opts: object) => Promise<void> }
}
interface GooglePickerBuilder {
  addView(v: GooglePickerView): this
  setOAuthToken(token: string): this
  setDeveloperKey(key: string): this
  setCallback(fn: (data: GooglePickerData) => void): this
  build(): { setVisible: (v: boolean) => void }
}
interface GooglePickerView { }
interface GooglePickerData {
  action: string
  docs?: { id: string }[]
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ')

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export default function App() {
  const [appState, setAppState] = useState<AppState>({ screen: 'idle' })
  const [sessions, setSessions] = useState<SavedSession[]>(getSessions)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [gapiReady, setGapiReady] = useState(false)
  const pickerRef = useRef<{ setVisible: (v: boolean) => void } | null>(null)

  // ── Load GAPI ────────────────────────────────────────────────────────────
  useEffect(() => {
    const onGapiLoad = () => {
      gapi.load('picker', () => setGapiReady(true))
    }
    if (typeof gapi !== 'undefined') {
      onGapiLoad()
    } else {
      const script = document.createElement('script')
      script.src = 'https://apis.google.com/js/api.js'
      script.onload = onGapiLoad
      document.head.appendChild(script)
    }
  }, [])

  // ── Google OAuth ─────────────────────────────────────────────────────────
  const login = useGoogleLogin({
    flow: 'implicit',
    scope: SCOPES,
    onSuccess: tokenResponse => {
      setAccessToken(tokenResponse.access_token)
      setAppState({ screen: 'idle' })
    },
    onError: (err) => {
      console.error('OAuth error:', err)
      const detail = (err as { error?: string; error_description?: string })?.error_description
        ?? (err as { error?: string })?.error
        ?? JSON.stringify(err)
      setAppState({ screen: 'error', message: `Sign-in failed: ${detail}` })
    },
  })

  // ── Load document ────────────────────────────────────────────────────────
  const loadDoc = useCallback(async (docId: string, token: string) => {
    setAppState({ screen: 'loading-doc', docId, accessToken: token })
    try {
      const doc = await fetchAndParseDoc(docId, token)
      setAppState({ screen: 'reading', doc, accessToken: token })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error loading document.'
      setAppState({ screen: 'error', message: msg })
    }
  }, [])

  const handleDocSelected = useCallback((docId: string) => {
    if (!accessToken) return
    void loadDoc(docId, accessToken)
  }, [accessToken, loadDoc])

  const handleDocLoaded = useCallback((doc: ParsedDoc) => {
    setAppState({ screen: 'reading', doc })
  }, [])

  const handleResumeSession = useCallback((session: SavedSession) => {
    setAppState({ screen: 'reading', doc: session.doc })
  }, [])

  const handleDeleteSession = useCallback((id: string) => {
    deleteSession(id)
    setSessions(getSessions())
  }, [])

  // Refresh session list whenever returning to idle
  useEffect(() => {
    if (appState.screen === 'idle') {
      setSessions(getSessions())
    }
  }, [appState.screen])

  // ── Google Picker ────────────────────────────────────────────────────────
  const openPicker = useCallback(() => {
    if (!gapiReady || !accessToken || typeof google === 'undefined') {
      setAppState({
        screen: 'error',
        message: 'Drive browser is not ready yet. Please wait a moment and try again, or paste your document link instead.',
      })
      return
    }

    const view = new google.picker.View(google.picker.ViewId.DOCS)
    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(accessToken)
      .setCallback((data: GooglePickerData) => {
        if (data.action === google.picker.Action.PICKED && data.docs?.[0]?.id) {
          void loadDoc(data.docs[0].id, accessToken)
        }
      })

    if (GOOGLE_API_KEY) {
      builder.setDeveloperKey(GOOGLE_API_KEY)
    }

    const picker = builder.build()
    picker.setVisible(true)
    pickerRef.current = picker
  }, [gapiReady, accessToken, loadDoc])

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <ThemePicker />
      {appState.screen === 'idle' && (
        <>
          <div className="landing">
            <h1>Lace's Super Cool Highlighter Reading App!</h1>
            <p className="tagline">
              Read aloud from a Google Doc, or paste the text here.             
            </p>
            <p>It follows along and highlights each word as you say it! Yippee!</p>
          </div>

          {sessions.length > 0 && (
            <div className="saved-sessions">
              <h2>Continue Reading</h2>
              <ul className="session-list">
                {sessions.map(s => {
                  const pct = s.wordCount > 0
                    ? Math.round(((s.highlightedUpTo + 1) / s.wordCount) * 100)
                    : 0
                  const date = new Date(s.lastAccessed)
                  const timeAgo = formatTimeAgo(date)
                  return (
                    <li key={s.id} className="session-item">
                      <button
                        className="session-resume-btn"
                        onClick={() => handleResumeSession(s)}
                      >
                        <span className="session-title">{s.title}</span>
                        <span className="session-meta">
                          {pct}% read · {timeAgo}
                        </span>
                        <span className="session-progress-bar">
                          <span
                            className="session-progress-fill"
                            style={{ width: `${pct}%` }}
                          />
                        </span>
                      </button>
                      <button
                        className="session-delete-btn"
                        onClick={() => handleDeleteSession(s.id)}
                        title="Remove this session"
                        aria-label={`Remove ${s.title}`}
                      >
                        ✕
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <DocLoader
            accessToken={accessToken}
            onDocSelected={handleDocSelected}
            onDocLoaded={handleDocLoaded}
            onOpenPicker={openPicker}
            onSignIn={() => login()}
          />
        </>
      )}

      {appState.screen === 'loading-doc' && (
        <div className="loading-screen">
          <div className="spinner" />
          <p>Loading your document…</p>
        </div>
      )}

      {appState.screen === 'reading' && (
        <Reader
          doc={appState.doc}
          onBack={() => setAppState({ screen: 'idle' })}
        />
      )}

      {appState.screen === 'error' && (
        <div className="error-screen">
          <h2>Something went wrong</h2>
          <p>{appState.message}</p>
          <button
            className="primary-btn"
            onClick={() => {
              setAppState({ screen: 'idle' })
            }}
          >
            Go back
          </button>
        </div>
      )}
    </div>
  )
}
