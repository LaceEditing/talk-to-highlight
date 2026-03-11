import { useEffect, useState } from 'react'

const SIZE_KEY   = 'tth-font-size'
const FAMILY_KEY = 'tth-font-family'

const DEFAULT_SIZE   = 20
const DEFAULT_FAMILY = 'system-mono'
const MIN_SIZE = 12
const MAX_SIZE = 36
const STEP     = 2

interface FontOption {
  id:     string
  label:  string
  value:  string
  google: string | null   // Google Fonts family name if applicable
}

const FONTS: FontOption[] = [
  {
    id:     'system-mono',
    label:  'Monospace (default)',
    value:  "'Consolas', 'Menlo', 'Monaco', 'Courier New', monospace",
    google: null,
  },
  {
    id:     'georgia',
    label:  'Georgia',
    value:  "Georgia, 'Times New Roman', serif",
    google: null,
  },
  {
    id:     'lora',
    label:  'Lora',
    value:  "'Lora', Georgia, serif",
    google: 'Lora',
  },
  {
    id:     'merriweather',
    label:  'Merriweather',
    value:  "'Merriweather', Georgia, serif",
    google: 'Merriweather',
  },
  {
    id:     'inter',
    label:  'Inter',
    value:  "'Inter', system-ui, sans-serif",
    google: 'Inter',
  },
]

function loadGoogleFont(family: string) {
  const id = `gfont-${family.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id   = id
  link.rel  = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,700;1,400&display=swap`
  document.head.appendChild(link)
}

function applyStyle(size: number, familyId: string) {
  const font = FONTS.find(f => f.id === familyId) ?? FONTS[0]
  if (font.google) loadGoogleFont(font.google)
  const root = document.documentElement
  root.style.setProperty('--reader-font-size',   `${size}px`)
  root.style.setProperty('--reader-font-family', font.value)
}

function useTextStyle(): [number, string, (size: number) => void, (familyId: string) => void] {
  const [size, setSizeState] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem(SIZE_KEY) ?? '', 10)
    return isNaN(saved) ? DEFAULT_SIZE : saved
  })
  const [familyId, setFamilyIdState] = useState<string>(() => {
    return localStorage.getItem(FAMILY_KEY) ?? DEFAULT_FAMILY
  })

  useEffect(() => {
    applyStyle(size, familyId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setSize(s: number) {
    const clamped = Math.min(MAX_SIZE, Math.max(MIN_SIZE, s))
    localStorage.setItem(SIZE_KEY, String(clamped))
    applyStyle(clamped, familyId)
    setSizeState(clamped)
  }

  function setFamily(id: string) {
    localStorage.setItem(FAMILY_KEY, id)
    applyStyle(size, id)
    setFamilyIdState(id)
  }

  return [size, familyId, setSize, setFamily]
}

export function TextStylePicker() {
  const [size, familyId, setSize, setFamily] = useTextStyle()

  return (
    <div className="text-style-picker">
      <select
        className="font-family-select"
        value={familyId}
        onChange={e => setFamily(e.target.value)}
        aria-label="Font family"
      >
        {FONTS.map(f => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>

      <div className="font-size-row">
        <button
          onClick={() => setSize(size - STEP)}
          disabled={size <= MIN_SIZE}
          aria-label="Decrease font size"
        >
          −
        </button>
        <span className="font-size-display">{size}</span>
        <button
          onClick={() => setSize(size + STEP)}
          disabled={size >= MAX_SIZE}
          aria-label="Increase font size"
        >
          +
        </button>
      </div>
    </div>
  )
}
