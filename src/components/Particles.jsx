import { useRef, useEffect } from 'react'
import useGameStore from '../store/useGameStore'

// Lightweight canvas particle system — purely decorative overlay, zero interaction with other components
export default function Particles() {
  const canvasRef = useRef(null)
  const themeColor = useGameStore(s => s.themeColor)
  const selectedGameId = useGameStore(s => s.selectedGame?.id)
  const burstRef = useRef([])
  const prevGameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animId

    // Parse theme color or use default pink
    const [r, g, b] = themeColor || [230, 25, 77]

    // Resize canvas to window
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Ambient particles
    const COUNT = 35
    const particles = Array.from({ length: COUNT }, () => createParticle(canvas))

    function createParticle(cvs) {
      return {
        x: Math.random() * cvs.width,
        y: Math.random() * cvs.height,
        size: Math.random() * 2.5 + 1,
        speedY: -(Math.random() * 0.3 + 0.1),
        speedX: (Math.random() - 0.5) * 0.15,
        phase: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.4 + 0.1,
        pulseSpeed: Math.random() * 0.01 + 0.005,
      }
    }

    let time = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time++

      // Draw ambient particles
      for (const p of particles) {
        p.y += p.speedY
        p.x += p.speedX + Math.sin(time * 0.008 + p.phase) * 0.2
        if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
        if (p.x < -10) p.x = canvas.width + 10
        if (p.x > canvas.width + 10) p.x = -10
        const alpha = p.opacity * (0.7 + 0.3 * Math.sin(time * p.pulseSpeed))
        drawGlow(ctx, p.x, p.y, p.size, r, g, b, alpha)
      }

      // Draw burst particles
      const bursts = burstRef.current
      for (let i = bursts.length - 1; i >= 0; i--) {
        const bp = bursts[i]
        bp.life -= 0.008
        if (bp.life <= 0) { bursts.splice(i, 1); continue }
        bp.x += bp.vx
        bp.y += bp.vy
        bp.vy += 0.01 // slight gravity
        bp.vx *= 0.995
        const alpha = bp.life * bp.maxOpacity
        drawGlow(ctx, bp.x, bp.y, bp.size, r, g, b, alpha)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [themeColor])

  // Burst on game switch
  useEffect(() => {
    if (!selectedGameId || !canvasRef.current) return
    if (prevGameRef.current && prevGameRef.current !== selectedGameId) {
      // Spawn burst particles from center
      const cx = canvasRef.current.width / 2
      const cy = canvasRef.current.height / 2
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * 3 + 1
        burstRef.current.push({
          x: cx + (Math.random() - 0.5) * 200,
          y: cy + (Math.random() - 0.5) * 200,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 1.5,
          life: 1.0,
          maxOpacity: Math.random() * 0.5 + 0.3,
        })
      }
    }
    prevGameRef.current = selectedGameId
  }, [selectedGameId])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 5 }}
    />
  )
}

function drawGlow(ctx, x, y, size, r, g, b, alpha) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 4)
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.6})`)
  gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`)
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, size * 4, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = `rgba(${Math.min(r + 60, 255)}, ${Math.min(g + 60, 255)}, ${Math.min(b + 60, 255)}, ${alpha})`
  ctx.beginPath()
  ctx.arc(x, y, size, 0, Math.PI * 2)
  ctx.fill()
}
