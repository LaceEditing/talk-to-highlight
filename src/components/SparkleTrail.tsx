import { useEffect } from 'react'

function hexToRgb(hex: string): string {
  const h = hex.trim().replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

export function SparkleTrail() {
  useEffect(() => {
    const BASE = `
      position: fixed;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: opacity 0.4s ease;
      opacity: 0;
    `

    // Large soft halo
    const halo = document.createElement('div')
    halo.style.cssText = BASE + 'width: 110px; height: 110px;'

    // Small bright core
    const core = document.createElement('div')
    core.style.cssText = BASE + 'width: 32px; height: 32px;'

    document.body.appendChild(halo)
    document.body.appendChild(core)

    function applyColors() {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      const rgb = hexToRgb(accent || '#7c5cbf')
      halo.style.background = `radial-gradient(circle, rgba(${rgb},0.22) 0%, rgba(${rgb},0.08) 45%, transparent 70%)`
      halo.style.filter = 'blur(4px)'
      core.style.background = `radial-gradient(circle, rgba(${rgb},0.55) 0%, rgba(${rgb},0.22) 55%, transparent 100%)`
      core.style.filter = 'blur(1.5px)'
    }
    applyColors()

    const themeObserver = new MutationObserver(applyColors)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    const target = { x: -300, y: -300 }
    const pos    = { x: -300, y: -300 }
    let rafId: number
    let visible = false

    function tick() {
      pos.x += (target.x - pos.x) * 0.12
      pos.y += (target.y - pos.y) * 0.12
      halo.style.left = `${pos.x}px`
      halo.style.top  = `${pos.y}px`
      core.style.left = `${pos.x}px`
      core.style.top  = `${pos.y}px`
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    function handleMove(e: MouseEvent) {
      target.x = e.clientX
      target.y = e.clientY
      if (!visible) {
        visible = true
        halo.style.opacity = '1'
        core.style.opacity = '1'
      }
    }

    window.addEventListener('mousemove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      cancelAnimationFrame(rafId)
      themeObserver.disconnect()
      halo.remove()
      core.remove()
    }
  }, [])

  return null
}

