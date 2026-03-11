import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ParsedDoc } from '../utils/docParser'
import { createMatcherState, processSpokenWords } from '../utils/wordMatcher'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { getSessionForDoc, saveSession } from '../utils/sessionStore'

interface Props {
  doc: ParsedDoc
  onBack: () => void
}

export function Reader({ doc, onBack }: Props) {
  const [matcherState, setMatcherState] = useState<ReturnType<typeof createMatcherState>>(() => {
    const session = getSessionForDoc(doc)
    if (session && session.highlightedUpTo >= 0 && session.highlightedUpTo < doc.words.length) {
      return { pointer: session.highlightedUpTo + 1, highlightedUpTo: session.highlightedUpTo, missStreak: 0 }
    }
    return createMatcherState()
  })
  // Confirmed state only advances on finalized speech results
  const confirmedStateRef = useRef(matcherState)
  const currentWordRef = useRef<HTMLSpanElement | null>(null)
  const docContentRef = useRef<HTMLDivElement | null>(null)
  const [paraNavOpen, setParaNavOpen] = useState(true)

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

  // Persist reading progress to session store
  useEffect(() => {
    saveSession(doc, matcherState.highlightedUpTo)
  }, [doc, matcherState.highlightedUpTo])

  // Auto-scroll to keep the current highlighted word in view
  useEffect(() => {
    currentWordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [matcherState.highlightedUpTo])

  // Spacebar toggles listening (skip when focused on an input/button)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code !== 'Space') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      e.preventDefault()
      if (modelLoading) return
      if (isListening) {
        stopListening()
      } else {
        startListening()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isListening, modelLoading, startListening, stopListening])

  // Jump the highlight to a specific word index (used by double-click & paragraph nav)
  const jumpTo = useCallback((wordIndex: number) => {
    const clamped = Math.max(0, Math.min(wordIndex, doc.words.length - 1))
    const next = { pointer: clamped + 1, highlightedUpTo: clamped, missStreak: 0 }
    confirmedStateRef.current = next
    setMatcherState(next)
  }, [doc.words.length])

  const handleWordDoubleClick = useCallback((e: React.MouseEvent, wIdx: number) => {
    e.preventDefault()
    jumpTo(wIdx)
  }, [jumpTo])

  // Paragraph previews for nav sidebar
  const paraInfo = useMemo(() => doc.paragraphs.map((wordIndices, pIdx) => {
    const previewWords = wordIndices.slice(0, 6).map(i => doc.words[i].text)
    const preview = previewWords.join(' ') + (wordIndices.length > 6 ? '…' : '')
    return { pIdx, firstWordIdx: wordIndices[0], lastWordIdx: wordIndices[wordIndices.length - 1], preview }
  }), [doc.paragraphs, doc.words])

  // Which paragraph is currently active (contains highlightedUpTo)
  const activeParagraph = useMemo(() => {
    if (matcherState.highlightedUpTo < 0) return -1
    for (let i = 0; i < paraInfo.length; i++) {
      if (matcherState.highlightedUpTo >= paraInfo[i].firstWordIdx &&
          matcherState.highlightedUpTo <= paraInfo[i].lastWordIdx) return i
    }
    return -1
  }, [matcherState.highlightedUpTo, paraInfo])

  const jumpToParagraph = useCallback((pIdx: number) => {
    if (pIdx < 0 || pIdx >= paraInfo.length) return
    // Jump to first word of the paragraph, but set highlightedUpTo to one before it
    // so the paragraph starts un-highlighted and the pointer is at the first word
    const firstWord = paraInfo[pIdx].firstWordIdx
    const next = { pointer: firstWord, highlightedUpTo: firstWord - 1, missStreak: 0 }
    confirmedStateRef.current = next
    setMatcherState(next)
  }, [paraInfo])

  const jumpPrevParagraph = useCallback(() => {
    const target = activeParagraph > 0 ? activeParagraph - 1 : 0
    jumpToParagraph(target)
  }, [activeParagraph, jumpToParagraph])

  const jumpNextParagraph = useCallback(() => {
    const target = activeParagraph < paraInfo.length - 1 ? activeParagraph + 1 : paraInfo.length - 1
    jumpToParagraph(target)
  }, [activeParagraph, paraInfo.length, jumpToParagraph])

  function handleReset() {
    stopListening()
    const fresh = createMatcherState()
    confirmedStateRef.current = fresh
    setMatcherState(fresh)
    saveSession(doc, -1)
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

      {/* ── Paragraph nav + Document text ───────────────────── */}
      <div className="reader-body">
        {/* ── Paragraph navigation sidebar ──────────────────── */}
        <nav className={`para-nav${paraNavOpen ? ' open' : ''}`}>
          <div className="para-nav-header">
            <span className="para-nav-title">Paragraphs</span>
            <button className="para-nav-close" onClick={() => setParaNavOpen(false)} title="Close">✕</button>
          </div>
          <div className="para-nav-arrows">
            <button
              className="para-nav-arrow"
              onClick={jumpPrevParagraph}
              disabled={activeParagraph <= 0}
              title="Previous paragraph"
            >↑ Prev</button>
            <button
              className="para-nav-arrow"
              onClick={jumpNextParagraph}
              disabled={activeParagraph >= paraInfo.length - 1}
              title="Next paragraph"
            >↓ Next</button>
          </div>
          <ol className="para-nav-list">
            {paraInfo.map(({ pIdx, preview }) => (
              <li key={pIdx}>
                <button
                  className={`para-nav-item${pIdx === activeParagraph ? ' active' : ''}`}
                  onClick={() => jumpToParagraph(pIdx)}
                >
                  <span className="para-nav-num">{pIdx + 1}</span>
                  <span className="para-nav-preview">{preview}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* ── Floating toggle for paragraph nav ─────────────── */}
        {!paraNavOpen && (
          <button
            className="para-nav-toggle"
            onClick={() => setParaNavOpen(true)}
            title="Open paragraph navigator"
          >
            ¶
          </button>
        )}

        {/* ── Document text ─────────────────────────────────── */}
        <div className="doc-content" ref={docContentRef}>
          {doc.paragraphs.map((wordIndices, pIdx) => (
            <p key={pIdx} className="doc-paragraph" data-para={pIdx}>
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
                    onDoubleClick={(e) => handleWordDoubleClick(e, wIdx)}
                  >
                    {word.text}{' '}
                  </span>
                )
              })}
            </p>
          ))}
        </div>
      </div>

      {/* ── Backdrop for mobile nav ─────────────────────────── */}
      {paraNavOpen && <div className="para-nav-backdrop" onClick={() => setParaNavOpen(false)} />}
    </div>
  )
}
