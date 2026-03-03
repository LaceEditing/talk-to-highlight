import { useCallback, useEffect, useRef, useState } from 'react'
import type { KaldiRecognizer, Model } from 'vosk-browser'
import type { ServerMessagePartialResult, ServerMessageResult } from 'vosk-browser/dist/interfaces'

interface Options {
  /** Called on every finalized batch of spoken words */
  onWords: (words: string[]) => void
  /** Called on each interim (in-progress) update with the full interim word list */
  onInterimWords?: (words: string[]) => void
}

// ── Singleton model so we only download the ~40 MB model once ──────────────
let modelPromise: Promise<Model> | null = null

const MODEL_URL = '/vosk-models/vosk-model-small-en-us-0.15.tar.gz'

function loadModel(): Promise<Model> {
  if (!modelPromise) {
    modelPromise = import('vosk-browser').then(({ createModel }) =>
      createModel(MODEL_URL),
    )
    // If loading fails, reset so the user can retry
    modelPromise.catch(() => {
      modelPromise = null
    })
  }
  return modelPromise
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useSpeechRecognition({ onWords, onInterimWords }: Options) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [modelLoading, setModelLoading] = useState(false)

  const onWordsRef = useRef(onWords)
  const onInterimWordsRef = useRef(onInterimWords)
  const recognizerRef = useRef<KaldiRecognizer | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const activeRef = useRef(false)

  useEffect(() => { onWordsRef.current = onWords }, [onWords])
  useEffect(() => { onInterimWordsRef.current = onInterimWords }, [onInterimWords])

  const cleanup = useCallback(() => {
    try { processorRef.current?.disconnect() } catch (_) { /* ignore */ }
    try { sourceRef.current?.disconnect() } catch (_) { /* ignore */ }
    try { audioContextRef.current?.close() } catch (_) { /* ignore */ }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop())
    try { recognizerRef.current?.remove() } catch (_) { /* ignore */ }

    processorRef.current = null
    sourceRef.current = null
    audioContextRef.current = null
    mediaStreamRef.current = null
    recognizerRef.current = null
  }, [])

  const startListening = useCallback(async () => {
    if (activeRef.current) return
    activeRef.current = true

    try {
      setError(null)
      setModelLoading(true)

      // 1. Load the Vosk model (cached after first download)
      const model = await loadModel()

      // User may have clicked stop while model was downloading
      if (!activeRef.current) {
        setModelLoading(false)
        return
      }

      // 2. Request microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      if (!activeRef.current) {
        stream.getTracks().forEach(t => t.stop())
        setModelLoading(false)
        return
      }

      // 3. Set up audio pipeline
      //    Vosk's small-en-us model expects 16 kHz. Using a 16 kHz AudioContext
      //    lets the browser handle hardware resampling transparently.
      const audioContext = new AudioContext({ sampleRate: 16000 })
      const source = audioContext.createMediaStreamSource(stream)
      const recognizer = new model.KaldiRecognizer(audioContext.sampleRate)

      recognizer.on('result', (message) => {
        const msg = message as ServerMessageResult
        const text = msg.result?.text
        if (text) {
          console.log('[Vosk] final:', text)
          const words = text.trim().split(/\s+/).filter(Boolean)
          if (words.length > 0) {
            setTranscript('')
            onInterimWordsRef.current?.([])
            onWordsRef.current(words)
          }
        }
      })

      recognizer.on('partialresult', (message) => {
        const msg = message as ServerMessagePartialResult
        const partial = msg.result?.partial
        if (partial) {
          setTranscript(partial)
          const words = partial.trim().split(/\s+/).filter(Boolean)
          if (words.length > 0) {
            onInterimWordsRef.current?.(words)
          }
        }
      })

      // Feed audio to Vosk via ScriptProcessorNode.
      // We copy the Float32Array before passing it because vosk-browser
      // transfers the underlying ArrayBuffer to its Worker.
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        try {
          const input = event.inputBuffer.getChannelData(0)
          const copy = new Float32Array(input)
          recognizer.acceptWaveformFloat(copy, audioContext.sampleRate)
        } catch (_) {
          // recognizer may have been freed
        }
      }
      source.connect(processor)
      processor.connect(audioContext.destination)

      // Store refs for cleanup
      recognizerRef.current = recognizer
      audioContextRef.current = audioContext
      mediaStreamRef.current = stream
      processorRef.current = processor
      sourceRef.current = source

      setIsListening(true)
      setModelLoading(false)
      console.log('[Vosk] listening started')
    } catch (err: unknown) {
      activeRef.current = false
      setModelLoading(false)
      console.error('[Vosk] start error:', err)

      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError(
          'Microphone access was denied. Please allow microphone access and try again.',
        )
      } else {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to start speech recognition.',
        )
      }
    }
  }, [cleanup])

  const stopListening = useCallback(() => {
    activeRef.current = false
    cleanup()
    setIsListening(false)
    setTranscript('')
    setModelLoading(false)
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false
      cleanup()
    }
  }, [cleanup])

  return { isListening, error, transcript, startListening, stopListening, modelLoading }
}

