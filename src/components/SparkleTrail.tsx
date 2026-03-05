import { useEffect } from 'react'

const CHARS = ['✦', '✧', '⋆', '·', '✶', '*', '˚', '⁕', '✸']
const COLORS = ['#d4a8ff', '#ffb3de', '#ffe066', '#a8f0d4', '#b3d9ff', '#ffcba0', '#ffffff', '#e8a0ff']

export function SparkleTrail() {
  useEffect(() => {
    const container = document.createElement('div')
    container.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;'
    document.body.appendChild(container)

    let lastMoveTime = 0
    let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

    function spawn(x: number, y: number, count: number) {
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span')
        const size = Math.random() * 14 + 7
        const angle = Math.random() * 360
        const dist = Math.random() * 55 + 15
        const dur = Math.random() * 600 + 450
        const dx = Math.cos((angle * Math.PI) / 180) * dist
        const dy = Math.sin((angle * Math.PI) / 180) * dist
        const color = COLORS[Math.floor(Math.random() * COLORS.length)]
        const char = CHARS[Math.floor(Math.random() * CHARS.length)]

        el.textContent = char
        el.style.cssText = `
          position: absolute;
          left: ${x}px;
          top: ${y}px;
          font-size: ${size}px;
          line-height: 1;
          color: ${color};
          text-shadow: 0 0 8px ${color}, 0 0 16px ${color};
          pointer-events: none;
          user-select: none;
          transform: translate(-50%, -50%);
          animation: sparkle-fly ${dur}ms ease-out forwards;
          --dx: ${dx}px;
          --dy: ${dy}px;
        `
        container.appendChild(el)
        setTimeout(() => el.remove(), dur + 50)
      }
    }

    function handleMove(e: MouseEvent) {
      pos = { x: e.clientX, y: e.clientY }
      const now = Date.now()
      if (now - lastMoveTime < 14) return
      lastMoveTime = now
      spawn(pos.x, pos.y, Math.floor(Math.random() * 3) + 3)
    }

    // Idle emission: 1-2 particles every 120ms even when not moving
    const idleInterval = setInterval(() => {
      spawn(pos.x, pos.y, Math.floor(Math.random() * 2) + 1)
    }, 120)

    window.addEventListener('mousemove', handleMove)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      clearInterval(idleInterval)
      container.remove()
    }
  }, [])

  return null
}

