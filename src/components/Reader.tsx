import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParsedDoc } from '../utils/docParser'
import { createMatcherState, processSpokenWords } from '../utils/wordMatcher'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'

interface Props {
  doc: ParsedDoc
  onBack: () => void
}

export function Reader({ doc, onBack }: Props) {
  const [matcherState, setMatcherState] = useState(createMatcherState)
  // Confirmed state only advances on finalized speech results
  const confirmedStateRef = useRef(createMatcherState())
  const currentWordRef = useRef<HTMLSpanElement | null>(null)

  const handleWords = useCallback(
    (words: string[]) => {
      setMatcherState(prev => {
        const next = processSpokenWords(words, doc.words, prev)
        confirmedStateRef.current = next
        return next
      })
    },
    [doc.words],
  )

  // Interim words: speculatively advance from the last confirmed state so
  // each word lights up as you say it without waiting for Chrome to finalise
  const handleInterimWords = useCallback(
    (words: string[]) => {
      if (words.length === 0) {
        setMatcherState(confirmedStateRef.current)
        return
      }
      setMatcherState(processSpokenWords(words, doc.words, confirmedStateRef.current))
    },
    [doc.words],
  )

  const { isListening, error, transcript, startListening, stopListening, modelLoading } =
    useSpeechRecognition({ onWords: handleWords, onInterimWords: handleInterimWords })

  // Auto-scroll to keep the current highlighted word in view
  useEffect(() => {
    currentWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [matcherState.highlightedUpTo])

  function handleReset() {
    stopListening()
    const fresh = createMatcherState()
    confirmedStateRef.current = fresh
    setMatcherState(fresh)
  }

  const progress = doc.words.length > 0
    ? Math.round(((matcherState.highlightedUpTo + 1) / doc.words.length) * 100)
    : 0

  return (
    <div className="reader">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="reader-header">
        <button className="back-btn" onClick={onBack} title="Choose a different document">
          ← Back
        </button>
        <span className="doc-title">{doc.title}</span>
        <span className="progress-label">{progress}% read</span>
      </header>

      {/* ── Controls ────────────────────────────────────────── */}
      <div className="controls">
        {!isListening && !modelLoading ? (
          <button className="primary-btn start-btn" onClick={startListening}>
            🎤 Start Reading Aloud
          </button>
        ) : modelLoading ? (
          <button className="primary-btn start-btn" disabled>
            ⏳ Loading speech model…
          </button>
        ) : (
          <button className="stop-btn" onClick={stopListening}>
            ⏸ Pause
          </button>
        )}
        <button className="reset-btn" onClick={handleReset}>
          ↺ Start Over
        </button>
      </div>

      {/* ── Error message ───────────────────────────────────── */}
      {error && <div className="speech-error">{error}</div>}

      {/* ── Listening indicator ─────────────────────────────── */}
      {isListening && (
        <div className="listening-indicator">
          <span className="dot" /> Listening…
          {transcript && (
            <span className="interim-transcript"> "{transcript}"</span>
          )}
        </div>
      )}

      {/* ── Document text ───────────────────────────────────── */}
      <div className="doc-content">
        {doc.paragraphs.map((wordIndices, pIdx) => (
          <p key={pIdx} className="doc-paragraph">
            {wordIndices.map(wIdx => {
              const word = doc.words[wIdx]
              const isHighlighted = wIdx <= matcherState.highlightedUpTo
              const isCurrent = wIdx === matcherState.highlightedUpTo

              return (
                <span
                  key={wIdx}
                  ref={isCurrent ? currentWordRef : null}
                  className={
                    isCurrent
                      ? 'word current'
                      : isHighlighted
                        ? 'word highlighted'
                        : 'word'
                  }
                >
                  {word.text}{' '}
                </span>
              )
            })}
          </p>
        ))}
      </div>
    </div>
  )
}
