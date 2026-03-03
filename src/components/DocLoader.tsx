import { useState } from 'react'
import { extractDocId } from '../utils/docParser'

interface Props {
  accessToken: string
  onDocSelected: (docId: string) => void
  onOpenPicker: () => void
}

export function DocLoader({ onDocSelected, onOpenPicker }: Props) {
  const [tab, setTab] = useState<'url' | 'picker'>('url')
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

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
    setTab('picker')
    onOpenPicker()
  }

  return (
    <div className="doc-loader">
      <h2>Choose a Google Doc</h2>

      <div className="tabs">
        <button
          className={tab === 'url' ? 'tab active' : 'tab'}
          onClick={() => setTab('url')}
        >
          Paste a link
        </button>
        <button
          className={tab === 'picker' ? 'tab active' : 'tab'}
          onClick={handlePickerClick}
        >
          Browse my Drive
        </button>
      </div>

      {tab === 'url' && (
        <div className="tab-panel">
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
        </div>
      )}

      {tab === 'picker' && (
        <div className="tab-panel picker-panel">
          <div id="picker-container" />
          <p className="hint">
            If the file browser didn't open, click "Browse my Drive" again.
          </p>
        </div>
      )}
    </div>
  )
}
