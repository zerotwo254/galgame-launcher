import { create } from 'zustand'

export function toImgSrc(filePath) {
  if (!filePath) return null
  return 'localfile:///' + filePath.replace(/\\/g, '/')
}

let _mediaPort = 0
export function toVideoSrc(filePath) {
  if (!filePath) return null
  const normalized = filePath.replace(/\\/g, '/')
  // Don't encode drive letter colon
  const parts = normalized.split('/')
  const encoded = parts.map((p, i) => {
    if (i === 0 && /^[A-Za-z]:$/.test(p)) return p
    return encodeURIComponent(p)
  }).join('/')
  return `http://127.0.0.1:${_mediaPort}/${encoded}`
}

export function gameGradient(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h)
  const hue = Math.abs(h) % 360
  return `linear-gradient(150deg, hsl(${hue},55%,14%) 0%, hsl(${(hue+50)%360},45%,7%) 100%)`
}

const useGameStore = create((set, get) => ({
  libraryPath:  null,
  games:        [],
  hiddenGames:  [],
  selectedGame: null,
  recentGames:  [],
  transcodingGames: new Set(),  // gameIds currently being transcoded
  view:         'focus',
  searchQuery:  '',
  showHidden:   false,
  isLoading:    false,
  config:       null,
  themeColor:   null,   // [r, g, b] extracted from cover, or null for default

  initApp: async () => {
    _mediaPort = await window.api.media.getPort()
    const config = await window.api.config.get()
    set({ config })
    if (config.libraryPath) {
      await get().loadLibrary(config.libraryPath, config)
    }

    // Listen for transcoding events
    window.api.media.onTranscodeStart(({ gameId }) => {
      set(s => {
        const next = new Set(s.transcodingGames)
        next.add(gameId)
        return { transcodingGames: next }
      })
    })

    window.api.media.onTranscoded(({ gameId, cachedPath }) => {
      set(s => {
        const next = new Set(s.transcodingGames)
        next.delete(gameId)
        return { transcodingGames: next }
      })
      get()._patchGame(gameId, { videoPath: cachedPath })
    })

    window.api.media.onTranscodeFailed(({ gameId }) => {
      set(s => {
        const next = new Set(s.transcodingGames)
        next.delete(gameId)
        return { transcodingGames: next }
      })
    })
  },

  loadLibrary: async (libraryPath, config) => {
    set({ isLoading: true })
    const cfg = config || get().config
    let rawGames
    try {
      rawGames = await window.api.library.scan(libraryPath)
    } catch (e) {
      console.error('scan failed', e)
      set({ isLoading: false })
      return
    }

    let games
    try {
      games = await Promise.all(
        rawGames.map(async g => ({
          ...g,
          exeIcon: g.exePath
            ? await window.api.game.getIcon(g.exePath).catch(() => null)
            : null,
        }))
      )
    } catch {
      games = rawGames
    }

    const recentIds = cfg?.recentGames || []
    const hiddenIds = cfg?.hiddenGames || []
    const visibleGames = games.filter(g => !hiddenIds.includes(g.id))
    const hiddenGamesList = games.filter(g => hiddenIds.includes(g.id))
    const firstGame = visibleGames.find(g => g.id === recentIds[0]) || visibleGames[0] || null
    set({ games: visibleGames, hiddenGames: hiddenGamesList, libraryPath, selectedGame: firstGame, recentGames: recentIds, isLoading: false })

    // On-demand transcode for initially selected game
    if (firstGame) get()._requestTranscodeIfNeeded(firstGame)
    // Extract theme color from first game's cover
    get()._extractThemeColor(firstGame)

    // Fetch covers & logos in background
    get()._fetchCovers(games)
    get()._fetchLogos(games)
  },

  setLibraryPath: async (libraryPath) => {
    try {
      const config = { ...get().config, libraryPath }
      await window.api.config.save(config)
      set({ config })
      await get().loadLibrary(libraryPath, config)
    } catch (e) {
      console.error('setLibraryPath error', e)
      set({ isLoading: false })
    }
  },

  selectGame: (game) => {
    const { recentGames, config } = get()
    const newRecent = [game.id, ...recentGames.filter(id => id !== game.id)].slice(0, 5)
    const newConfig = { ...config, recentGames: newRecent }
    set({ selectedGame: game, view: 'focus', recentGames: newRecent, config: newConfig })
    window.api.config.save(newConfig)
    // On-demand transcode: if current video needs transcoding, request it now
    get()._requestTranscodeIfNeeded(game)
    // Update theme color from new game's cover
    get()._extractThemeColor(game)
  },

  launchGame: async (game) => {
    await window.api.game.launch(game.exePath)
    get().selectGame(game)
  },

  setView:        (view) => set({ view }),
  setSearchQuery: (q)    => set({ searchQuery: q }),
  toggleShowHidden: ()   => set(s => ({ showHidden: !s.showHidden })),

  hideGame: async (gameId) => {
    const { config, games, hiddenGames, selectedGame } = get()
    const game = games.find(g => g.id === gameId)
    if (!game) return
    const newHidden = [...(config.hiddenGames || []), gameId]
    const newConfig = { ...config, hiddenGames: newHidden }
    await window.api.config.save(newConfig)
    const newGames = games.filter(g => g.id !== gameId)
    const newSelected = selectedGame?.id === gameId ? (newGames[0] || null) : selectedGame
    set({ config: newConfig, games: newGames, hiddenGames: [...hiddenGames, game], selectedGame: newSelected })
  },

  unhideGame: async (gameId) => {
    const { config, hiddenGames, games } = get()
    const game = hiddenGames.find(g => g.id === gameId)
    if (!game) return
    const newHidden = (config.hiddenGames || []).filter(id => id !== gameId)
    const newConfig = { ...config, hiddenGames: newHidden }
    await window.api.config.save(newConfig)
    set({ config: newConfig, games: [...games, game], hiddenGames: hiddenGames.filter(g => g.id !== gameId) })
  },

  updateGameExe: async (gameId, exePath) => {
    const { config, games } = get()
    const newConfig = { ...config, selectedExes: { ...config.selectedExes, [gameId]: exePath } }
    await window.api.config.save(newConfig)
    const exeIcon = exePath ? await window.api.game.getIcon(exePath).catch(() => null) : null
    const updated = games.map(g => g.id === gameId ? { ...g, exePath, exeIcon } : g)
    set({
      config: newConfig,
      games: updated,
      selectedGame: get().selectedGame?.id === gameId
        ? { ...get().selectedGame, exePath, exeIcon }
        : get().selectedGame,
    })
  },

  updateGameName: async (gameId, name) => {
    const { config, games } = get()
    const newConfig = { ...config, customNames: { ...config.customNames, [gameId]: name } }
    await window.api.config.save(newConfig)
    const updated = games.map(g => g.id === gameId ? { ...g, name } : g)
    set({
      config: newConfig,
      games: updated,
      selectedGame: get().selectedGame?.id === gameId
        ? { ...get().selectedGame, name }
        : get().selectedGame,
    })
  },

  updateGameCover: async (gameId) => {
    const game = get().games.find(g => g.id === gameId)
    if (!game) return
    const defaultPath = game.exePath?.replace(/[^/\\]+$/, '') || ''
    const filePath = await window.api.game.selectImageFile(defaultPath)
    if (!filePath) return
    await window.api.game.setMedia(gameId, { coverPath: filePath })
    get()._patchGame(gameId, { coverPath: filePath })
  },

  _patchGame: (gameId, patch) => {
    set(s => ({
      games: s.games.map(g => g.id === gameId ? { ...g, ...patch } : g),
      selectedGame: s.selectedGame?.id === gameId
        ? { ...s.selectedGame, ...patch }
        : s.selectedGame,
    }))
  },

  // Extract dominant color from game cover and apply as CSS variables
  _extractThemeColor: async (game) => {
    if (!game?.coverPath) {
      set({ themeColor: null })
      document.documentElement.style.setProperty('--accent-r', '230')
      document.documentElement.style.setProperty('--accent-g', '25')
      document.documentElement.style.setProperty('--accent-b', '77')
      return
    }
    const rgb = await window.api.image.getDominantColor(game.coverPath)
    if (rgb) {
      set({ themeColor: rgb })
      document.documentElement.style.setProperty('--accent-r', String(rgb[0]))
      document.documentElement.style.setProperty('--accent-g', String(rgb[1]))
      document.documentElement.style.setProperty('--accent-b', String(rgb[2]))
    } else {
      set({ themeColor: null })
      document.documentElement.style.setProperty('--accent-r', '230')
      document.documentElement.style.setProperty('--accent-g', '25')
      document.documentElement.style.setProperty('--accent-b', '77')
    }
  },

  // Request transcode for a game's current video if needed
  _requestTranscodeIfNeeded: async (game) => {
    if (!game?.videoPath) return
    const playable = await window.api.media.isPlayable(game.videoPath)
    if (!playable) {
      window.api.media.requestTranscode(game.id, game.videoPath)
    }
  },

  // Fetch Bangumi covers in background
  _fetchCovers: async (games) => {
    for (const game of games) {
      await new Promise(r => setTimeout(r, 300))
      if (!game.coverPath) {
        const coverPath = await window.api.cover.fetch(game.id, game.name)
        if (coverPath) get()._patchGame(game.id, { coverPath })
      }
    }
  },

  // Fetch SteamGridDB logos in background (up to 3 per game)
  _fetchLogos: async (games) => {
    for (const game of games) {
      await new Promise(r => setTimeout(r, 500))
      if (!game.logoPath) {
        const paths = await window.api.logo.fetch(game.id, game.name)
        if (paths?.length) {
          get()._patchGame(game.id, { logoPath: paths[0], logoOptions: paths })
        }
      }
    }
  },

  setGameLogo: async (gameId, logoPath) => {
    await window.api.game.setMedia(gameId, { logoPath })
    get()._patchGame(gameId, { logoPath })
  },

  resetGame: async (gameId) => {
    const freshGame = await window.api.game.resetCustom(gameId)
    if (!freshGame) return
    // Get exe icon for the fresh data
    freshGame.exeIcon = freshGame.exePath
      ? await window.api.game.getIcon(freshGame.exePath).catch(() => null)
      : null
    // Reload config
    const config = await window.api.config.get()
    set(s => ({
      config,
      games: s.games.map(g => g.id === gameId ? { ...g, ...freshGame } : g),
      selectedGame: s.selectedGame?.id === gameId ? { ...s.selectedGame, ...freshGame } : s.selectedGame,
    }))
    // Check if auto-detected video needs transcode
    if (freshGame.videoPath) get()._requestTranscodeIfNeeded(freshGame)
  },

  updateGameLogo: async (gameId) => {
    const game = get().games.find(g => g.id === gameId)
    if (!game) return
    const filePath = await window.api.game.selectLogoFile('')
    if (!filePath) return
    await window.api.game.setMedia(gameId, { logoPath: filePath })
    get()._patchGame(gameId, { logoPath: filePath })
  },
}))

// Helper: get accent color as CSS string
export function useAccentCSS() {
  const tc = useGameStore(s => s.themeColor)
  const r = tc?.[0] ?? 230, g = tc?.[1] ?? 25, b = tc?.[2] ?? 77
  const hex = '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
  const light = '#' + [r, g, b].map(c => Math.min(255, c + Math.round((255 - c) * 0.35)).toString(16).padStart(2, '0')).join('')
  return { accent: hex, accentLight: light, accentRgb: `${r},${g},${b}` }
}

export default useGameStore
