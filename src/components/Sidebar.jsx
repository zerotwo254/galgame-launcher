import { motion } from 'framer-motion'
import useGameStore from '../store/useGameStore'

export default function Sidebar() {
  const { view, setView } = useGameStore()

  return (
    <div
      className="drag-region flex flex-col items-center justify-end py-3 flex-shrink-0 h-full"
      style={{
        width: 68,
        background: view === 'focus' ? 'transparent' : 'rgba(20,20,20,0.95)',
        borderRight: view === 'focus' ? 'none' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Grid view toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setView(view === 'library' ? 'focus' : 'library')}
        className="no-drag w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
        style={{
          background: view === 'library' ? 'rgba(230,25,77,0.2)' : 'rgba(255,255,255,0.06)',
          color: view === 'library' ? '#e6194d' : 'rgba(255,255,255,0.4)',
        }}
        title={view === 'library' ? '详情视图' : '网格视图'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </motion.button>
    </div>
  )
}
