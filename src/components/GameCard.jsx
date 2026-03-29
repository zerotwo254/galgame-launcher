import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { toImgSrc, gameGradient } from '../store/useGameStore'

export default function GameCard({ game, selected, onClick }) {
  const [imgError, setImgError] = useState(false)
  const hasCover = game.coverPath && !imgError
  const cardRef = useRef(null)
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 })

  const handleMouseMove = useCallback((e) => {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = (e.clientX - rect.left) / rect.width - 0.5   // -0.5 ~ 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTilt({ rx: -y * 18, ry: x * 18 })
  }, [])

  const handleMouseLeave = useCallback(() => {
    setTilt({ rx: 0, ry: 0 })
  }, [])

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.15 }}
      className="no-drag flex flex-col items-center gap-2 outline-none group w-full"
    >
      {/* Steam-style portrait cover with 3D tilt */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative overflow-hidden w-full"
        style={{
          aspectRatio: '2 / 3',
          borderRadius: 8,
          transform: `perspective(600px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
          transition: tilt.rx === 0 && tilt.ry === 0 ? 'transform 0.4s ease-out' : 'transform 0.1s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {hasCover ? (
          <img
            src={toImgSrc(game.coverPath)}
            alt={game.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: gameGradient(game.id) }}>
            <span className="text-white/20 font-bold text-4xl">{game.name[0]}</span>
          </div>
        )}

        {/* Light sweep */}
        <div className="light-sweep absolute inset-0 overflow-hidden" style={{ borderRadius: 8 }} />

        {/* Dim non-selected */}
        {!selected && (
          <div className="absolute inset-0 transition-opacity duration-200 group-hover:opacity-0"
            style={{ background: 'rgba(23,23,23,0.3)' }} />
        )}

        {/* Shine highlight that follows tilt */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{
            background: `radial-gradient(circle at ${50 + tilt.ry * 3}% ${50 - tilt.rx * 3}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
          }}
        />

        {/* Ubiquity animated border for selected */}
        {selected && (
          <div className="ubiquity-border absolute inset-0 pointer-events-none" style={{ borderRadius: 8 }} />
        )}
      </div>

      {/* Name */}
      <p className="text-center text-white/50 group-hover:text-white/80 transition-colors leading-snug w-full"
        style={{
          fontSize: 11,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
        {game.name}
      </p>
    </motion.button>
  )
}
