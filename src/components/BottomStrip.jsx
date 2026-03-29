import { useRef, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useGameStore, { toImgSrc, gameGradient } from '../store/useGameStore'

function Thumb({ game, selected, onClick, onContextMenu }) {
  const [tip, setTip] = useState(null)
  return (
    <motion.button
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseMove={e => setTip({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setTip(null)}
      animate={{ scale: selected ? 1.06 : 0.93 }}
      whileHover={{ scale: selected ? 1.06 : 1.0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="no-drag flex-shrink-0 relative outline-none group overflow-hidden"
      style={{
        width: 'clamp(120px, 12vw, 330px)',
        height: 'clamp(170px, 17vw, 465px)',
        borderRadius: 10,
      }}
    >
      {/* Cursor tooltip with cover preview */}
      {tip && (
        <div className="fixed z-[9999] pointer-events-none flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-white/90 whitespace-nowrap"
          style={{
            left: tip.x + 12, top: tip.y + 16,
            background: 'rgba(15,15,15,0.88)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(12px)',
            fontSize: 11,
          }}>
          {game.coverPath && (
            <img src={toImgSrc(game.coverPath)} alt=""
              className="rounded object-cover" style={{ width: 28, height: 40 }} />
          )}
          <span>{game.name}</span>
        </div>
      )}
      {/* Cover image */}
      {game.coverPath ? (
        <img src={toImgSrc(game.coverPath)} alt={game.name}
          className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: gameGradient(game.id) }}>
          <span className="text-white/25 font-bold text-3xl">{game.name[0]}</span>
        </div>
      )}

      {/* Light sweep effect */}
      <div className="light-sweep absolute inset-0 overflow-hidden rounded-[10px]" />

      {/* Dim overlay for non-selected */}
      {!selected && (
        <div className="absolute inset-0 transition-opacity duration-200 group-hover:opacity-0"
          style={{ background: 'rgba(23,23,23,0.35)' }} />
      )}

      {/* Name overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)' }}>
        <p className="text-white text-center leading-tight"
          style={{
            fontSize: 10,
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
          {game.name}
        </p>
      </div>

      {/* Ubiquity animated border for selected */}
      {selected && (
        <div className="ubiquity-border absolute inset-0 rounded-[10px] pointer-events-none" />
      )}
    </motion.button>
  )
}

const MENU_ITEMS = [
  {
    label: '更改封面',
    icon: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
    action: 'cover',
  },
  {
    label: '更改背景',
    icon: 'M4 4h7V2H4c-1.1 0-2 .9-2 2v7h2V4zm6 9l-4 5h12l-3-4-2.03 2.71L10 13zm7-4.5c0-.83-.67-1.5-1.5-1.5S14 7.67 14 8.5s.67 1.5 1.5 1.5S17 9.33 17 8.5zm3-6h-7v2h7v7h2V4c0-1.1-.9-2-2-2zm0 18h-7v2h7c1.1 0 2-.9 2-2v-7h-2v7zM4 13H2v7c0 1.1.9 2 2 2h7v-2H4v-7z',
    action: 'bg',
  },
  {
    label: '更改视频',
    icon: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    action: 'video',
  },
  {
    label: '更改标题',
    icon: 'M2.5 4v3h5v12h3V7h5V4h-13z',
    action: 'logo',
  },
  {
    label: '更改 exe',
    icon: 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10v-4H8v-2h6V6l4 5-4 5z',
    action: 'exe',
  },
  {
    label: '改名',
    icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
    action: 'rename',
  },
  {
    label: '恢复默认',
    icon: 'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z',
    action: 'reset',
  },
  {
    label: '从库中隐藏',
    icon: 'M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z',
    action: 'hide',
    danger: true,
  },
]

function ContextMenu({ x, y, game, onClose }) {
  const menuRef = useRef(null)

  // Pause idle timer while context menu is open
  useEffect(() => {
    window.dispatchEvent(new Event('idle-pause'))
    return () => window.dispatchEvent(new Event('idle-resume'))
  }, [])

  const [showLogoOptions, setShowLogoOptions] = useState(false)
  const [showCoverOptions, setShowCoverOptions] = useState(false)
  const [vndbUrl, setVndbUrl] = useState('')
  const [vndbError, setVndbError] = useState('')
  const [vndbLoading, setVndbLoading] = useState(false)
  const [logoSearch, setLogoSearch] = useState('')
  const [logoError, setLogoError] = useState('')
  const [logoLoading, setLogoLoading] = useState(false)
  const [showBgOptions, setShowBgOptions] = useState(false)
  const [bgSearch, setBgSearch] = useState('')
  const [bgError, setBgError] = useState('')
  const [bgLoading, setBgLoading] = useState(false)
  const store = useGameStore

  // Adjust position to keep menu on screen
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    if (!menuRef.current) return
    const rect = menuRef.current.getBoundingClientRect()
    const nx = x + rect.width > window.innerWidth ? x - rect.width : x
    const ny = y + rect.height > window.innerHeight ? y - rect.height : y
    setPos({ x: Math.max(0, nx), y: Math.max(0, ny) })
  }, [x, y])

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleBgSearch = async () => {
    if (!bgSearch.trim()) return
    setBgError('')
    setBgLoading(true)
    const result = await window.api.bg.fetchByInput(game.id, bgSearch.trim())
    setBgLoading(false)
    if (result.error) {
      setBgError(result.error)
      return
    }
    await window.api.game.setMedia(game.id, { bgPath: result.bgPath, videoPath: null })
    store.getState()._patchGame(game.id, { bgPath: result.bgPath, videoPath: null, bgWide: result.bgWide })
    onClose()
  }

  const handleLogoSearch = async () => {
    if (!logoSearch.trim()) return
    setLogoError('')
    setLogoLoading(true)
    const result = await window.api.logo.fetchByName(game.id, logoSearch.trim())
    setLogoLoading(false)
    if (result.error) {
      setLogoError(result.error)
      return
    }
    // Use first logo and update options
    store.getState()._patchGame(game.id, { logoPath: result.paths[0], logoOptions: result.paths })
    await window.api.game.setMedia(game.id, { logoPath: result.paths[0] })
    onClose()
  }

  const handleVndbCover = async () => {
    if (!vndbUrl.trim()) return
    setVndbError('')
    setVndbLoading(true)
    const result = await window.api.cover.fetchByUrl(game.id, vndbUrl.trim())
    setVndbLoading(false)
    if (result.error) {
      setVndbError(result.error)
      return
    }
    await window.api.game.setMedia(game.id, { coverPath: result.coverPath })
    store.getState()._patchGame(game.id, { coverPath: result.coverPath })
    onClose()
  }

  const closeAllSubs = () => { setShowLogoOptions(false); setShowCoverOptions(false); setShowBgOptions(false) }

  const handleAction = (action) => {
    if (action === 'logo') {
      closeAllSubs(); setShowLogoOptions(v => !v)
      return
    }
    if (action === 'cover') {
      closeAllSubs(); setShowCoverOptions(v => !v)
      return
    }
    if (action === 'bg') {
      closeAllSubs(); setShowBgOptions(v => !v)
      return
    }

    const gameId = game.id
    const gameData = { ...game }
    const defaultPath = game.exePath?.replace(/[^/\\]+$/, '') || ''
    onClose()

    // Delay async operations to ensure menu is fully unmounted before dialog opens
    setTimeout(async () => {
      if (action === 'video') {
        const filePath = await window.api.game.selectMediaFile(defaultPath)
        if (filePath) {
          await window.api.game.setMedia(gameId, { videoPath: filePath, bgPath: null })
          store.getState()._patchGame(gameId, { videoPath: filePath, bgPath: null })
          // Check if transcoding is needed
          const playable = await window.api.media.isPlayable(filePath)
          if (!playable) {
            window.api.media.requestTranscode(gameId, filePath)
          }
        }
      } else if (action === 'exe') {
        const exePath = await window.api.game.selectExe(defaultPath)
        if (exePath) store.getState().updateGameExe(gameId, exePath)
      } else if (action === 'rename') {
        store.getState().selectGame(gameData)
        setTimeout(() => window.dispatchEvent(new CustomEvent('open-rename', { detail: gameData })), 100)
      } else if (action === 'reset') {
        store.getState().resetGame(gameId)
      } else if (action === 'hide') {
        store.getState().hideGame(gameId)
      }
    }, 50)
  }

  const logoOptions = game.logoOptions || []
  const currentLogo = game.logoPath

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[99999] no-drag"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className="py-1.5 rounded-xl overflow-hidden shadow-2xl"
        style={{
          background: 'rgba(20,20,20,0.72)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          minWidth: 160,
        }}
      >
        {MENU_ITEMS.map((item, idx) => (
          <div key={item.action}>
            {item.danger && <div className="mx-2.5 my-1" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />}
            <button
              onClick={() => handleAction(item.action)}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs transition-colors text-left ${
                item.danger
                  ? 'text-red-400/70 hover:text-red-300 hover:bg-red-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 opacity-60">
                <path d={item.icon} />
              </svg>
              {item.label}
              {(item.action === 'logo' || item.action === 'cover' || item.action === 'bg') && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"
                  className="ml-auto opacity-40" style={{ transform: (item.action === 'logo' ? showLogoOptions : item.action === 'cover' ? showCoverOptions : showBgOptions) ? 'rotate(180deg)' : '' }}>
                  <path d="M7 10l5 5 5-5z" />
                </svg>
              )}
            </button>

            {/* Cover options submenu */}
            {item.action === 'cover' && showCoverOptions && (
              <div className="px-2 pb-1.5">
                <button
                  onClick={() => { const gid = game.id; onClose(); setTimeout(() => store.getState().updateGameCover(gid), 50) }}
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-[11px] text-white/35
                             hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10v-4H8v-2h6V6l4 5-4 5z" />
                  </svg>
                  选择图片文件…
                </button>
                <div className="px-1.5 py-1">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={vndbUrl}
                      onChange={e => { setVndbUrl(e.target.value); setVndbError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleVndbCover()}
                      placeholder="粘贴 VNDB / Bangumi 网址…"
                      className="flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] text-white/80 placeholder-white/20
                                 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    <button
                      onClick={handleVndbCover}
                      disabled={vndbLoading || !vndbUrl.trim()}
                      className="px-2 py-1 rounded-md text-[11px] transition-colors whitespace-nowrap"
                      style={{
                        background: vndbLoading ? 'rgba(255,255,255,0.03)' : 'rgba(255,107,157,0.15)',
                        color: vndbLoading ? 'rgba(255,255,255,0.3)' : '#ff6b9d',
                      }}
                    >
                      {vndbLoading ? '获取中…' : '获取'}
                    </button>
                  </div>
                  {vndbError && (
                    <p className="text-red-400/80 text-[10px] mt-1">{vndbError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Background options submenu */}
            {item.action === 'bg' && showBgOptions && (
              <div className="px-2 pb-1.5">
                <button
                  onClick={() => {
                    const gid = game.id; const dp = game.exePath?.replace(/[^/\\]+$/, '') || ''
                    onClose()
                    setTimeout(async () => {
                      const filePath = await window.api.game.selectImageFile(dp)
                      if (filePath) {
                        const size = await window.api.image.getSize(filePath)
                        const bgWide = size ? (size.width / size.height >= 2.5) : false
                        await window.api.game.setMedia(gid, { bgPath: filePath, videoPath: null })
                        store.getState()._patchGame(gid, { bgPath: filePath, videoPath: null, bgWide })
                      }
                    }, 50)
                  }}
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-[11px] text-white/35
                             hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10v-4H8v-2h6V6l4 5-4 5z" />
                  </svg>
                  选择图片文件…
                </button>
                <div className="px-1.5 py-1">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={bgSearch}
                      onChange={e => { setBgSearch(e.target.value); setBgError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleBgSearch()}
                      placeholder="游戏名或 SteamGridDB 网址…"
                      className="flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] text-white/80 placeholder-white/20
                                 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    <button
                      onClick={handleBgSearch}
                      disabled={bgLoading || !bgSearch.trim()}
                      className="px-2 py-1 rounded-md text-[11px] transition-colors whitespace-nowrap"
                      style={{
                        background: bgLoading ? 'rgba(255,255,255,0.03)' : 'rgba(255,107,157,0.15)',
                        color: bgLoading ? 'rgba(255,255,255,0.3)' : '#ff6b9d',
                      }}
                    >
                      {bgLoading ? '搜索中…' : '搜索'}
                    </button>
                  </div>
                  {bgError && (
                    <p className="text-red-400/80 text-[10px] mt-1">{bgError}</p>
                  )}
                </div>
              </div>
            )}

            {/* Logo options submenu */}
            {item.action === 'logo' && showLogoOptions && (
              <div className="px-2 pb-1.5">
                {logoOptions.length > 0 && (
                  <div className="flex gap-2 px-1.5 py-1.5">
                    {logoOptions.map((opt, i) => {
                      const isActive = opt === currentLogo
                      return (
                        <button
                          key={i}
                          onClick={() => { store.getState().setGameLogo(game.id, opt); onClose() }}
                          className="relative rounded-lg overflow-hidden transition-all"
                          style={{
                            width: 80, height: 40,
                            background: 'rgba(255,255,255,0.05)',
                            border: isActive ? '2px solid #e6194d' : '2px solid transparent',
                          }}
                        >
                          <img src={toImgSrc(opt)} alt="" className="w-full h-full object-contain p-1" />
                        </button>
                      )
                    })}
                  </div>
                )}
                <button
                  onClick={() => { onClose(); store.getState().updateGameLogo(game.id) }}
                  className="w-full flex items-center gap-2 px-1.5 py-1.5 rounded-lg text-[11px] text-white/35
                             hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-50">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10v-4H8v-2h6V6l4 5-4 5z" />
                  </svg>
                  选择图片文件…
                </button>
                <div className="px-1.5 py-1">
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={logoSearch}
                      onChange={e => { setLogoSearch(e.target.value); setLogoError('') }}
                      onKeyDown={e => e.key === 'Enter' && handleLogoSearch()}
                      placeholder="游戏名或 SteamGridDB 网址…"
                      className="flex-1 min-w-0 px-2 py-1 rounded-md text-[11px] text-white/80 placeholder-white/20
                                 outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    />
                    <button
                      onClick={handleLogoSearch}
                      disabled={logoLoading || !logoSearch.trim()}
                      className="px-2 py-1 rounded-md text-[11px] transition-colors whitespace-nowrap"
                      style={{
                        background: logoLoading ? 'rgba(255,255,255,0.03)' : 'rgba(255,107,157,0.15)',
                        color: logoLoading ? 'rgba(255,255,255,0.3)' : '#ff6b9d',
                      }}
                    >
                      {logoLoading ? '搜索中…' : '搜索'}
                    </button>
                  </div>
                  {logoError && (
                    <p className="text-red-400/80 text-[10px] mt-1">{logoError}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export default function BottomStrip() {
  const { games, selectedGame, selectGame } = useGameStore()
  const scrollRef = useRef(null)
  const [contextMenu, setContextMenu] = useState(null)

  // Auto-scroll to selected game
  useEffect(() => {
    if (!scrollRef.current || !selectedGame) return
    const idx = games.findIndex(g => g.id === selectedGame.id)
    if (idx < 0) return
    const el = scrollRef.current.children[idx]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [selectedGame?.id])

  const onWheel = (e) => {
    if (scrollRef.current) {
      e.preventDefault()
      scrollRef.current.scrollLeft += e.deltaY
    }
  }

  const handleContextMenu = (e, game) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, game })
  }

  return (
    <div
      className="flex-shrink-0 drag-region relative"
      style={{ height: 'clamp(210px, 35vh, 560px)' }}
    >
      {/* Section label */}
      <div className="no-drag absolute top-2 left-5 z-10">
        <p className="text-white/25 text-[10px] font-medium uppercase"
          style={{ letterSpacing: '0.2em' }}>
          R E C E N T L Y &nbsp; A D D E D
        </p>
      </div>

      {/* Scrollable strip with fade edges */}
      <div
        ref={scrollRef}
        onWheel={onWheel}
        className="fade-bottom-strip flex items-end h-full px-5 pb-4 pt-5 overflow-x-auto no-drag"
        style={{ scrollbarWidth: 'none', gap: 'clamp(8px, 1.5vw, 28px)' }}
      >
        {games.map(game => (
          <Thumb
            key={game.id}
            game={game}
            selected={selectedGame?.id === game.id}
            onClick={() => selectGame(game)}
            onContextMenu={(e) => handleContextMenu(e, game)}
          />
        ))}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            game={contextMenu.game}
            onClose={() => setContextMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
