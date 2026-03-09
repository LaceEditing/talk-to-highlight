import { useState, useRef } from 'react'
import mammoth from 'mammoth'
import { extractDocId, parseRawText } from '../utils/docParser'
import type { ParsedDoc } from '../utils/docParser'

type SourceTab = 'paste' | 'google-url' | 'google-picker' | 'upload'

interface Props {
  accessToken: string | null
  onDocSelected: (docId: string) => void
  onDocLoaded: (doc: ParsedDoc) => void
  onOpenPicker: () => void
  onSignIn: () => void
}

export function DocLoader({ accessToken, onDocSelected, onDocLoaded, onOpenPicker, onSignIn }: Props) {
  const [tab, setTab] = useState<SourceTab>('paste')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState(() => {
    try { return localStorage.getItem('tth-paste-text') ?? '' } catch { return '' }
  })
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Google Docs URL submit ───────────────────────────────────────────────
  function handleUrlSubmit() {
    const docId = extractDocId(urlInput.trim())
    if (!docId) {
      setUrlError(
        "That doesn't look like a valid Google Doc link. Copy the full URL from your browser's address bar while the doc is open.",
      )
      return
    }
    setUrlError(null)
    onDocSelected(docId)
  }

  function handlePickerClick() {
    setTab('google-picker')
    onOpenPicker()
  }

  // ── Paste text submit ────────────────────────────────────────────────────
  function handlePasteSubmit() {
    const text = pasteText.trim()
    if (!text) {
      setPasteError('Paste or type some text first.')
      return
    }
    setPasteError(null)
    localStorage.removeItem('tth-paste-text')
    const doc = parseRawText('Pasted Text', text)
    onDocLoaded(doc)
  }

  // ── File upload handler ──────────────────────────────────────────────────
  async function handleFileUpload(file: File) {
    setUploadError(null)
    const title = file.name.replace(/\.[^.]+$/, '')
    const ext = file.name.split('.').pop()?.toLowerCase()

    try {
      let text: string

      if (ext === 'docx') {
        const arrayBuffer = await file.arrayBuffer()
        const result = await mammoth.extractRawText({ arrayBuffer })
        text = result.value.trim()
      } else {
        // .txt and other plain-text formats
        text = (await file.text()).trim()
      }

      if (!text) {
        setUploadError('The file appears to be empty.')
        return
      }
      onDocLoaded(parseRawText(title, text))
    } catch {
      setUploadError('Could not read the file. Make sure it\'s a supported format (.txt, .docx).')
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  const isGoogleTab = tab === 'google-url' || tab === 'google-picker'
  const needsSignIn = isGoogleTab && !accessToken

  return (
    <div className="doc-loader">
      <h2>Choose your text source</h2>

      <div className="tabs">
        <button
          className={tab === 'paste' ? 'tab active' : 'tab'}
          onClick={() => setTab('paste')}
        >
          Paste text
        </button>
        <button
          className={tab === 'google-url' ? 'tab active' : 'tab'}
          onClick={() => setTab('google-url')}
        >
          Google Doc link
        </button>
        <button
          className={tab === 'google-picker' ? 'tab active' : 'tab'}
          onClick={() => {
            if (accessToken) {
              handlePickerClick()
            } else {
              setTab('google-picker')
            }
          }}
        >
          Browse Drive
        </button>
        <button
          className={tab === 'upload' ? 'tab active' : 'tab'}
          onClick={() => setTab('upload')}
        >
          Upload file
        </button>
      </div>

      {/* ── Paste Text ──────────────────────────────────────────────────── */}
      {tab === 'paste' && (
        <div className="tab-panel">
          <label htmlFor="paste-text">
            Paste text from a website, document, Milanote board, or anywhere:
          </label>
          <textarea
            id="paste-text"
            className="paste-textarea"
            placeholder="Copy your text from a doc, txt, Milanote card, etc, and paste here..."
            value={pasteText}
            onChange={e => {
              const val = e.target.value
              setPasteText(val)
              try { localStorage.setItem('tth-paste-text', val) } catch { /* */ }
              setPasteError(null)
            }}
            rows={10}
          />
          {pasteError && <p className="field-error">{pasteError}</p>}
          <button className="primary-btn" onClick={handlePasteSubmit}>
            Start Reading
          </button>
        </div>
      )}

      {/* ── Google Doc URL ──────────────────────────────────────────────── */}
      {tab === 'google-url' && (
        <div className="tab-panel">
          {needsSignIn ? (
            <div className="sign-in-prompt">
              <p>Sign in with Google to load a document from your Drive.</p>
              <button className="primary-btn sign-in-btn" onClick={onSignIn}>
                Sign in with Google
              </button>
              <p className="hint">
                You'll be asked to allow read-only access to your Google Docs.
                No changes are ever made to your documents.
              </p>
            </div>
          ) : (
            <>
              <label htmlFor="doc-url">
                Open your document in Google Docs, then copy the link from your browser and paste it here:
              </label>
              <input
                id="doc-url"
                type="text"
                placeholder="https://docs.google.com/document/d/..."
                value={urlInput}
                onChange={e => {
                  setUrlInput(e.target.value)
                  setUrlError(null)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleUrlSubmit()
                }}
              />
              {urlError && <p className="field-error">{urlError}</p>}
              <button className="primary-btn" onClick={handleUrlSubmit}>
                Open Document
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Google Picker ───────────────────────────────────────────────── */}
      {tab === 'google-picker' && (
        <div className="tab-panel picker-panel">
          {needsSignIn ? (
            <div className="sign-in-prompt">
              <p>Sign in with Google to browse your Drive.</p>
              <button className="primary-btn sign-in-btn" onClick={onSignIn}>
                Sign in with Google
              </button>
            </div>
          ) : (
            <>
              <div id="picker-container" />
              <p className="hint">
                If the file browser didn't open, click "Browse Drive" again.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── Upload File ─────────────────────────────────────────────────── */}
      {tab === 'upload' && (
        <div className="tab-panel">
          <label>
            Upload a text file from your computer:
          </label>
          <div
            className="upload-dropzone"
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragover') }}
            onDragLeave={e => { e.currentTarget.classList.remove('dragover') }}
            onDrop={e => {
              e.preventDefault()
              e.currentTarget.classList.remove('dragover')
              const file = e.dataTransfer.files[0]
              if (file) handleFileUpload(file)
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="dropzone-text">
              Drag & drop a file here, or click to browse
            </p>
            <p className="dropzone-formats">Supports .txt, .docx</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden-file-input"
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
            />
          </div>
          {uploadError && <p className="field-error">{uploadError}</p>}
        </div>
      )}
    </div>
  )
}
