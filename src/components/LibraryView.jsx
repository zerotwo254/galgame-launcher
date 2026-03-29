import { motion } from 'framer-motion'
import useGameStore from '../store/useGameStore'
import GameCard from './GameCard'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
}
const item = {
  hidden: { opacity: 0, scale: 0.95 },
  show:   { opacity: 1, scale: 1, transition: { duration: 0.2 } },
}

export default function LibraryView() {
  const { games, hiddenGames, selectedGame, selectGame, setView, showHidden, toggleShowHidden, unhideGame } = useGameStore()

  const filtered = games

  return (
    <div className="drag-region flex flex-col h-full" style={{ background: '#171717' }}>
      {/* Header */}
      <div className="no-drag flex items-center gap-4 px-6 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button
          onClick={() => setView('focus')}
          className="w-8 h-8 rounded-lg flex items-center justify-center
                     hover:bg-white/10 transition-colors text-white/40 hover:text-white"
          title="返回"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h2 className="text-white/80 font-light text-lg uppercase" style={{ letterSpacing: '0.15em' }}>
          游戏库
        </h2>
        <span className="text-white/20 text-sm">{filtered.length}</span>

        {hiddenGames.length > 0 && (
          <button
            onClick={toggleShowHidden}
            className="ml-auto px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{
              background: showHidden ? 'rgba(230,25,77,0.15)' : 'rgba(255,255,255,0.04)',
              color: showHidden ? '#e6194d' : 'rgba(255,255,255,0.3)',
              border: `1px solid ${showHidden ? 'rgba(230,25,77,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            已隐藏 {hiddenGames.length}
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="no-drag flex-1 overflow-y-auto px-6 py-6">
        {/* Hidden games section — shown at top */}
        {showHidden && hiddenGames.length > 0 && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white/30 text-xs uppercase" style={{ letterSpacing: '0.15em' }}>已隐藏的游戏</h3>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid gap-5 mb-8"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(180px, 15vw, 280px), 1fr))',
              }}
            >
              {hiddenGames.map(game => (
                <motion.div key={game.id} variants={item} className="relative group/hidden">
                  <div className="opacity-50">
                    <GameCard game={game} selected={false} onClick={() => {}} />
                  </div>
                  <button
                    onClick={() => unhideGame(game.id)}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[11px]
                               opacity-0 group-hover/hidden:opacity-100 transition-opacity"
                    style={{
                      background: 'rgba(230,25,77,0.9)',
                      color: 'white',
                    }}
                  >
                    恢复
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-white/20">
            没有找到匹配的游戏
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid gap-5"
            style={{
              gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(180px, 15vw, 280px), 1fr))',
            }}
          >
            {filtered.map(game => (
              <motion.div key={game.id} variants={item}>
                <GameCard
                  game={game}
                  selected={selectedGame?.id === game.id}
                  onClick={() => selectGame(game)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Game count */}
        {filtered.length > 0 && (
          <div className="flex justify-end mt-4 pr-2">
            <span className="text-white/15 text-xs">
              All currently filtered games : <span style={{ color: '#e6194d' }}>{filtered.length}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
