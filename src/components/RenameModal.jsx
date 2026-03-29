import { useState } from 'react'
import { motion } from 'framer-motion'
import useGameStore from '../store/useGameStore'

export default function RenameModal({ game, onClose }) {
  const { updateGameName } = useGameStore()
  const [value, setValue] = useState(game.name)

  const handleSave = async () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== game.name) {
      await updateGameName(game.id, trimmed)
    }
    onClose()
  }

  return (
    <motion.div
      className="no-drag absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-4 p-6 rounded-xl w-80"
        style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h3 className="text-white/80 font-medium text-sm">重命名游戏</h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
          className="px-3 py-2 rounded-lg text-white text-sm outline-none
                     bg-white/[0.04] border border-white/[0.08] focus:border-[#e6194d]/50 transition-colors"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-white/30 hover:text-white text-sm transition-colors">
            取消
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ border: '1px solid #e6194d', background: 'rgba(230,25,77,0.1)' }}>
            保存
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
