import { useState } from 'react'
import { motion } from 'framer-motion'
import useGameStore from '../store/useGameStore'

export default function SetupModal() {
  const { setLibraryPath } = useGameStore()
  const [loading, setLoading] = useState(false)

  const handleSelect = async () => {
    try {
      if (!window.api) {
        alert('preload 未加载')
        return
      }
      const folder = await window.api.library.selectFolder()
      if (!folder) return
      setLoading(true)
      await setLibraryPath(folder)
    } catch (e) {
      alert('错误：' + e.message)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="no-drag fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(15,15,15,0.98)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-8 text-center max-w-sm"
      >
        {/* Logo area */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ border: '2px solid #e6194d', background: 'rgba(230,25,77,0.08)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e6194d" strokeWidth="1.5">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h1 className="text-white text-xl font-light uppercase" style={{ letterSpacing: '0.15em' }}>
            Galgame Launcher
          </h1>
          <p className="text-white/30 text-sm leading-relaxed">
            选择游戏库文件夹开始使用
          </p>
        </div>

        <motion.button
          whileHover={loading ? {} : { scale: 1.03 }}
          whileTap={loading ? {} : { scale: 0.97 }}
          onClick={handleSelect}
          disabled={loading}
          className="flex items-center justify-center gap-2 font-medium text-white transition-all"
          style={{
            width: 200,
            height: 48,
            borderRadius: 8,
            border: '2px solid #e6194d',
            background: loading ? 'rgba(230,25,77,0.15)' : 'rgba(230,25,77,0.08)',
            fontSize: 14,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading && (
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e6194d" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" className="opacity-20" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          )}
          {loading ? '扫描中...' : '选择游戏库'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
