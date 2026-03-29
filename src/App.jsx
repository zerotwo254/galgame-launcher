import { useEffect, useCallback, useState, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import useGameStore from './store/useGameStore'
import Sidebar from './components/Sidebar'
import FocusView from './components/FocusView'
import BottomStrip from './components/BottomStrip'
import LibraryView from './components/LibraryView'
import SetupModal from './components/SetupModal'
import WindowControls from './components/WindowControls'
import Particles from './components/Particles'

const BORDER = 14

function BorderDrag() {
  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    window.api.window.startDrag()
    const onUp = () => {
      window.api.window.stopDrag()
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mouseup', onUp)
  }, [])

  const style = { position: 'absolute', pointerEvents: 'auto' }
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9999, pointerEvents: 'none' }}>
      <div onMouseDown={onMouseDown} style={{ ...style, top: 0, left: 0, right: 0, height: BORDER, cursor: 'grab' }} />
      <div onMouseDown={onMouseDown} style={{ ...style, bottom: 0, left: 0, right: 0, height: BORDER, cursor: 'grab' }} />
      <div onMouseDown={onMouseDown} style={{ ...style, top: 0, left: 0, bottom: 0, width: BORDER, cursor: 'grab' }} />
      <div onMouseDown={onMouseDown} style={{ ...style, top: 0, right: 0, bottom: 0, width: BORDER, cursor: 'grab' }} />
    </div>
  )
}

export default function App() {
  const { view, libraryPath, initApp, selectedGame } = useGameStore()
  const [idle, setIdle] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { initApp() }, [])

  // Hide UI after 5s of cursor inactivity (only when video is playing in focus view)
  // Pause idle when context menu / input is active (via 'idle-pause' / 'idle-resume' events)
  const hasVideo = !!(view === 'focus' && selectedGame?.videoPath)
  const pausedRef = useRef(false)
  useEffect(() => {
    if (!hasVideo) { setIdle(false); clearTimeout(timerRef.current); return }
    const resetTimer = () => {
      setIdle(false)
      clearTimeout(timerRef.current)
      if (!pausedRef.current) {
        timerRef.current = setTimeout(() => setIdle(true), 5000)
      }
    }
    const onPause = () => { pausedRef.current = true; clearTimeout(timerRef.current); setIdle(false) }
    const onResume = () => { pausedRef.current = false; timerRef.current = setTimeout(() => setIdle(true), 5000) }
    window.addEventListener('mousemove', resetTimer)
    window.addEventListener('mousedown', resetTimer)
    window.addEventListener('idle-pause', onPause)
    window.addEventListener('idle-resume', onResume)
    return () => {
      window.removeEventListener('mousemove', resetTimer)
      window.removeEventListener('mousedown', resetTimer)
      window.removeEventListener('idle-pause', onPause)
      window.removeEventListener('idle-resume', onResume)
      clearTimeout(timerRef.current)
    }
  }, [hasVideo])

  return (
    <div className="flex w-screen h-screen overflow-hidden relative" style={{ background: '#171717' }}>
      {/* Draggable border frame for moving window — JS-based drag */}
      <BorderDrag />

      {/* Window controls — always on top */}
      <div className="transition-opacity duration-500" style={{ opacity: (view === 'focus' && idle) ? 0 : 1 }}>
        <WindowControls />
      </div>

      {/* Left sidebar */}
      <div className="transition-opacity duration-500 z-[70]"
        style={{
          opacity: (view === 'focus' && idle) ? 0 : 1,
          position: view === 'focus' ? 'absolute' : 'relative',
          top: 0, bottom: 0, left: 0,
        }}>
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-col flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'focus' ? (
            <motion.div
              key="focus"
              className="relative flex-1 overflow-hidden"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              {/* Video/bg fills entire area */}
              <FocusView idle={view === 'focus' && idle} />
              {/* Floating particle overlay */}
              <Particles />
              {/* Cover strip overlays at bottom — glassmorphism bg layer (no interaction) */}
              <div className="absolute bottom-0 left-0 right-0 z-[55] pointer-events-none transition-opacity duration-500"
                style={{
                  opacity: (view === 'focus' && idle) ? 0 : 1,
                  height: 'clamp(210px, 35vh, 560px)',
                  background: 'linear-gradient(to top, rgba(23,23,23,0.85) 0%, rgba(23,23,23,0.4) 60%, transparent 100%)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }} />
              {/* Cover strip interactive layer */}
              <div className="absolute bottom-0 left-0 right-0 z-[60] transition-opacity duration-500"
                style={{ opacity: (view === 'focus' && idle) ? 0 : 1 }}>
                <BottomStrip />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="library"
              className="flex-1 overflow-hidden"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <LibraryView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* First-run setup */}
      <AnimatePresence>
        {!libraryPath && <SetupModal />}
      </AnimatePresence>
    </div>
  )
}
