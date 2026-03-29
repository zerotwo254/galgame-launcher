import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useGameStore, { toImgSrc, toVideoSrc, useAccentCSS } from '../store/useGameStore'
import RenameModal from './RenameModal'

const VID_EXTS = new Set(['mp4', 'webm', 'wmv', 'mpg', 'mpeg', 'm4v'])
const IMG_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp'])

export default function FocusView({ idle }) {
  const { selectedGame, launchGame, updateGameExe, _patchGame, transcodingGames } = useGameStore()
  const { accent } = useAccentCSS()
  const [showRename, setShowRename]           = useState(false)
  const [showMediaPicker, setShowMediaPicker] = useState(false)
  const [muted, setMuted]                     = useState(false)
  const [btnHover, setBtnHover]               = useState(false)
  const [ripple, setRipple]                   = useState(null)
  const mutedBeforeHide = useRef(false)
  const pickerRef  = useRef(null)
  const videoRef   = useRef(null)

  // Close picker on game switch
  useEffect(() => {
    setShowMediaPicker(false)
  }, [selectedGame?.id])

  // Listen for rename event from context menu
  useEffect(() => {
    const handler = (e) => {
      if (selectedGame && e.detail?.id === selectedGame.id) {
        setShowRename(true)
      }
    }
    window.addEventListener('open-rename', handler)
    return () => window.removeEventListener('open-rename', handler)
  }, [selectedGame?.id])

  // When video changes: play with current muted state
  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted
    el.play().catch(() => {
      el.muted = true
      el.play().catch(() => {})
    })
  }, [selectedGame?.videoPath])

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted
  }, [muted])

  // Auto-mute on background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        mutedBeforeHide.current = muted
        if (videoRef.current) videoRef.current.muted = true
      } else {
        const restore = mutedBeforeHide.current
        if (videoRef.current) videoRef.current.muted = restore
        setMuted(restore)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [muted])

  // Outside click closes picker
  useEffect(() => {
    if (!showMediaPicker) return
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target))
        setShowMediaPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMediaPicker])

  const applyMedia = async (videoPath, bgPath) => {
    setShowMediaPicker(false)
    await window.api.game.setMedia(selectedGame.id, { videoPath, bgPath })
    _patchGame(selectedGame.id, {
      videoPath: videoPath ?? selectedGame.videoPath,
      bgPath:    bgPath    ?? selectedGame.bgPath,
    })
  }

  const handlePickVideo = (file) => {
    const videoPath = file.originalPath || file.path
    applyMedia(videoPath, selectedGame.bgPath)
    if (file.needsTranscode) {
      window.api.media.requestTranscode(selectedGame.id, videoPath)
    }
  }

  const handleBrowseVideo = async () => {
    setShowMediaPicker(false)
    const defaultPath = selectedGame.exePath?.replace(/[^/\\]+$/, '') || ''
    const filePath = await window.api.game.selectMediaFile(defaultPath)
    if (!filePath) return
    if (VID_EXTS.has(filePath.split('.').pop().toLowerCase())) {
      applyMedia(filePath, selectedGame.bgPath)
    }
  }

  const handleBrowseImage = async () => {
    setShowMediaPicker(false)
    const defaultPath = selectedGame.exePath?.replace(/[^/\\]+$/, '') || ''
    const filePath = await window.api.game.selectImageFile(defaultPath)
    if (!filePath) return
    applyMedia(selectedGame.videoPath, filePath)
  }

  const handleClearMedia = async () => {
    setShowMediaPicker(false)
    await window.api.game.setMedia(selectedGame.id, { videoPath: null, bgPath: null })
    _patchGame(selectedGame.id, { videoPath: null, bgPath: null })
  }

  const handleSelectExe = async () => {
    if (!selectedGame) return
    const exePath = await window.api.game.selectExe(
      selectedGame.exePath ? selectedGame.exePath.replace(/[^/\\]+$/, '') : ''
    )
    if (exePath) updateGameExe(selectedGame.id, exePath)
  }

  if (!selectedGame) {
    return (
      <div className="drag-region flex-1 flex items-center justify-center text-white/20 text-lg"
        style={{ background: '#171717' }}>
        没有游戏，请先添加游戏库
      </div>
    )
  }

  const videoSrc = selectedGame.videoPath || null
  const bgSrc    = selectedGame.bgPath    || null
  const bgWide   = selectedGame.bgWide    || false
  // Don't show video if it's currently being transcoded (would cause error 4)
  const hasVideo = !!videoSrc && !transcodingGames.has(selectedGame.id)
  const hasBg    = !!bgSrc
  const hasMedia = hasVideo || hasBg
  const videoFiles = selectedGame.videoFiles || []
  const exeName = selectedGame.exePath?.split(/[\\/]/).pop() || ''
  const isTranscoding = transcodingGames.has(selectedGame.id)

  return (
    <div className="drag-region absolute inset-0 overflow-hidden" style={{ background: '#171717' }}>
      {/* No-drag zone for window controls */}
      <div className="no-drag absolute top-0 right-0 w-36 h-10 z-40" />

      {/* ── Background layer ── */}
      <AnimatePresence mode="wait">
        {hasVideo ? (
          <motion.video
            ref={videoRef}
            key={selectedGame.id + '-v-' + videoSrc}
            src={toVideoSrc(videoSrc)}
            autoPlay
            loop
            playsInline
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            onError={e => {
              const err = e.target.error
              console.error('[Video] error:', err?.code, err?.message)
            }}
          />
        ) : hasBg ? (
          <motion.img
            key={selectedGame.id + '-bg-' + bgSrc}
            src={toImgSrc(bgSrc)}
            alt=""
            className="absolute w-full"
            style={bgWide ? {
              top: 0, left: 0, right: 0,
              height: 'calc(100% - clamp(210px, 35vh, 560px))',
              objectFit: 'cover',
              objectPosition: 'top center',
            } : {
              inset: 0, height: '100%',
              objectFit: 'cover',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
          />
        ) : null}
      </AnimatePresence>

      {/* ── Wide bg bottom fade ── */}
      {hasBg && bgWide && (
        <div className="absolute left-0 right-0 pointer-events-none"
          style={{
            bottom: 'clamp(210px, 35vh, 560px)',
            height: 120,
            background: 'linear-gradient(to top, rgba(23,23,23,1) 0%, transparent 100%)',
          }} />
      )}

      {/* ── Ubiquity-style overlays ── */}
      {hasMedia && (
        <div className="absolute inset-0 pointer-events-none transition-opacity duration-500"
          style={{ opacity: idle ? 0 : 1 }}>
          {/* Bottom gradient: strip readability */}
          {!bgWide && (
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(to top, rgba(23,23,23,1) 0%, rgba(23,23,23,0.4) 30%, transparent 55%)' }} />
          )}
          {/* Subtle overall dim */}
          <div className="absolute inset-0"
            style={{ background: 'rgba(23,23,23,0.15)' }} />
        </div>
      )}

      {/* Animated gradient background when no media */}
      {!hasMedia && (
        <div className="absolute inset-0 pointer-events-none animated-bg-gradient" />
      )}

      {/* ── Transcoding toast ── */}
      <AnimatePresence>
        {isTranscoding && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute z-50 left-1/2 -translate-x-1/2 flex items-center gap-3 px-5 py-3 rounded-xl"
            style={{
              top: 50,
              background: 'rgba(23,23,23,0.92)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" className="opacity-20" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
            <span className="text-white/70 text-sm">正在转换视频格式…</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Game info (left side, Ubiquity layout) ── */}
      <div className="absolute inset-0 flex flex-col justify-center no-drag transition-opacity duration-500"
        style={{ padding: '80px 0 clamp(210px, 35vh, 560px) 48px', opacity: idle ? 0 : 1 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedGame.id + '-info'}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="max-w-lg"
          >
            {/* Game logo or title */}
            {selectedGame.logoPath ? (
              <img
                src={toImgSrc(selectedGame.logoPath)}
                alt={selectedGame.name}
                className="mb-4 object-contain"
                style={{
                  maxWidth: 'clamp(160px, 35vw, 700px)',
                  maxHeight: 'clamp(60px, 18vh, 280px)',
                  filter: 'drop-shadow(0 6px 40px rgba(0,0,0,0.9))',
                }}
                draggable={false}
              />
            ) : (
              <h1
                className="font-bold text-white leading-tight mb-4"
                style={{
                  fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                  textShadow: '0 4px 30px rgba(0,0,0,0.8)',
                  letterSpacing: '-0.02em',
                }}
              >
                {selectedGame.name}
              </h1>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Action buttons — bottom right, above cover strip ── */}
      <div className="absolute z-[58] no-drag flex items-center gap-3 transition-opacity duration-500"
        style={{ right: 40, bottom: 'calc(clamp(210px, 35vh, 560px) - 24px)', opacity: idle ? 0 : 1 }}>
        {/* Launch button — Steam style, accent-colored, with ripple */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            setRipple({ x: e.clientX - rect.left, y: e.clientY - rect.top, key: Date.now() })
            launchGame(selectedGame)
          }}
          onMouseEnter={() => setBtnHover(true)}
          onMouseLeave={() => setBtnHover(false)}
          className="flex items-center justify-center gap-3 font-bold"
          style={{
            width: 'clamp(220px, 16vw, 300px)',
            height: 'clamp(48px, 4.5vh, 64px)',
            borderRadius: 32,
            fontSize: 'clamp(16px, 1.2vw, 20px)',
          }}
        >
          <div className="w-full h-full relative flex items-center justify-center rounded-full transition-all duration-200 border-2 overflow-hidden"
            style={{
              backdropFilter: 'blur(12px)',
              background: btnHover ? 'rgba(23,23,23,0.9)' : accent,
              borderColor: accent,
              color: btnHover ? accent : 'white',
            }}
          >
            {/* Ripple */}
            {ripple && (
              <span key={ripple.key} className="ripple-effect"
                style={{ left: ripple.x, top: ripple.y }}
                onAnimationEnd={() => setRipple(null)} />
            )}
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200"
              style={{ background: btnHover ? accent : 'rgba(0,0,0,0.8)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white" style={{ marginLeft: 2 }}>
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <span style={{ marginLeft: 24 }}>开始游戏</span>
          </div>
        </motion.button>

        {/* Mute button */}
        {hasVideo && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMuted(m => !m)}
            className="w-11 h-11 rounded-lg flex items-center justify-center transition-colors"
            style={{
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: muted ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)',
            }}
            title={muted ? '取消静音' : '静音'}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              </svg>
            )}
          </motion.button>
        )}
      </div>

      {showRename && (
        <RenameModal
          game={selectedGame}
          onClose={() => setShowRename(false)}
        />
      )}
    </div>
  )
}
