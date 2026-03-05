import { useEffect, useRef, useState } from 'react'

interface Theme {
  id: string
  label: string
  swatch: string
  bg: string
  dark: boolean
}

const THEMES: Theme[] = [
  { id: 'lavender', label: 'Lavender', swatch: '#7c5cbf', bg: '#f3eeff', dark: false },
  { id: 'rose',     label: 'Rose',     swatch: '#c0436d', bg: '#fff0f3', dark: false },
  { id: 'mint',     label: 'Mint',     swatch: '#2a9d6e', bg: '#edfff6', dark: false },
  { id: 'peach',    label: 'Peach',    swatch: '#c96a2a', bg: '#fff5ee', dark: false },
  { id: 'midnight', label: 'Midnight', swatch: '#a07ee8', bg: '#1a1428', dark: true  },
  { id: 'forest',   label: 'Forest',   swatch: '#56c47a', bg: '#141f18', dark: true  },
  { id: 'slate',    label: 'Slate',    swatch: '#5b8dd9', bg: '#141820', dark: true  },
  { id: 'obsidian', label: 'Obsidian', swatch: '#e060a0', bg: '#111114', dark: true  },
]

const STORAGE_KEY = 'tth-theme'
const DEFAULT = 'lavender'

function applyTheme(id: string) {
  document.documentElement.setAttribute('data-theme', id)
}

function useTheme(): [string, (id: string) => void] {
  const [theme, setThemeState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) ?? DEFAULT
    applyTheme(saved)
    return saved
  })

  function setTheme(id: string) {
    localStorage.setItem(STORAGE_KEY, id)
    applyTheme(id)
    setThemeState(id)
  }

  return [theme, setTheme]
}

export function ThemePicker() {
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const current = THEMES.find(t => t.id === theme) ?? THEMES[0]
  const light = THEMES.filter(t => !t.dark)
  const dark = THEMES.filter(t => t.dark)

  return (
    <div className="theme-picker" ref={containerRef}>
      <button
        className="theme-toggle-btn"
        onClick={() => setOpen(o => !o)}
        title="Change colour theme"
        aria-label="Change colour theme"
      >
        <span className="theme-swatch-preview" style={{ background: current.swatch }} />
        <span className="theme-toggle-label">Themes ✦</span>
      </button>

      {open && (
        <div className="theme-panel" role="dialog" aria-label="Choose a theme">
          <p className="theme-panel-label">Light</p>
          <div className="theme-swatches">
            {light.map(t => (
              <button
                key={t.id}
                className={'theme-swatch-btn' + (theme === t.id ? ' active' : '')}
                style={{ background: t.bg, border: `3px solid ${t.swatch}` }}
                onClick={() => { setTheme(t.id); setOpen(false) }}
                title={t.label}
                aria-label={t.label}
              />
            ))}
          </div>
          <p className="theme-panel-label">Dark</p>
          <div className="theme-swatches">
            {dark.map(t => (
              <button
                key={t.id}
                className={'theme-swatch-btn' + (theme === t.id ? ' active' : '')}
                style={{ background: t.bg, border: `3px solid ${t.swatch}` }}
                onClick={() => { setTheme(t.id); setOpen(false) }}
                title={t.label}
                aria-label={t.label}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
