const { app, BrowserWindow, ipcMain, dialog, protocol, net, session } = require('electron')
const path = require('path')
const fs = require('fs')
const url = require('url')
const http = require('http')
const crypto = require('crypto')
const { spawn, execFile } = require('child_process')

// ── safe console wrappers (avoid EPIPE crash when pipe is broken) ──
function safeLog(...args) { try { console.log(...args) } catch (_) {} }
function safeError(...args) { try { console.error(...args) } catch (_) {} }

// ── local media HTTP server (video only) ────────────────────────
let mediaPort = 0

function detectVideoMime(filePath, extMime) {
  try {
    const fd  = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(12)
    fs.readSync(fd, buf, 0, 12, 0)
    fs.closeSync(fd)
    // MPEG Program Stream (00 00 01 BA)
    if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0xBA) return 'video/mpeg'
    // MPEG Transport Stream (sync byte 0x47)
    if (buf[0] === 0x47) return 'video/mp2t'
    // MP4 / MOV (ftyp box)
    if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return 'video/mp4'
    // WebM / MKV
    if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return 'video/webm'
  } catch {}
  return extMime
}

function startMediaServer() {
  const EXT_MIME = {
    mp4: 'video/mp4', webm: 'video/webm', m4v: 'video/mp4',
    wmv: 'video/x-ms-wmv', mpg: 'video/mpeg', mpeg: 'video/mpeg',
  }
  const server = http.createServer((req, res) => {
    try {
      const filePath = decodeURIComponent(req.url.slice(1))
      if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return }
      const stat      = fs.statSync(filePath)
      const totalSize = stat.size
      const extMime   = EXT_MIME[path.extname(filePath).slice(1).toLowerCase()] || 'application/octet-stream'
      const mime      = detectVideoMime(filePath, extMime)
      const rangeHdr  = req.headers['range']
      if (rangeHdr) {
        const [, rng] = rangeHdr.split('=')
        const [s, e]  = rng.split('-')
        const start   = parseInt(s, 10)
        const end     = e ? Math.min(parseInt(e, 10), totalSize - 1) : totalSize - 1
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': end - start + 1,
          'Content-Type':   mime,
        })
        fs.createReadStream(filePath, { start, end }).pipe(res)
      } else {
        res.writeHead(200, { 'Content-Type': mime, 'Accept-Ranges': 'bytes', 'Content-Length': totalSize })
        fs.createReadStream(filePath).pipe(res)
      }
    } catch { res.writeHead(500); res.end() }
  })
  server.listen(0, '127.0.0.1', () => {
    mediaPort = server.address().port
    safeLog('[MediaServer] port', mediaPort)
  })
}

const isDev = !app.isPackaged

// Windows Media Foundation for WMV/MPEG + HEVC
app.commandLine.appendSwitch('enable-features', 'PlatformHEVCDecoderSupport')
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')
app.commandLine.appendSwitch('no-proxy-server')

// ── custom protocol ────────────────────────────────────────────
protocol.registerSchemesAsPrivileged([
  { scheme: 'localfile', privileges: { secure: true, standard: true, bypassCSP: true, supportFetchAPI: true, stream: true } },
])

// ── paths ──────────────────────────────────────────────────────
const configPath    = path.join(app.getPath('userData'), 'config.json')
const coversDir     = path.join(app.getPath('userData'), 'covers')
const logosDir      = path.join(app.getPath('userData'), 'logos')
const bgsDir        = path.join(app.getPath('userData'), 'backgrounds')
const videoCacheDir = path.join(app.getPath('userData'), 'video_cache')

// ── SteamGridDB ─────────────────────────────────────────────────
const STEAMGRIDDB_API_KEY = '285327df5e5db26119157e5e34c2bbc2'

async function searchSteamGridDB(term) {
  try {
    const encoded = encodeURIComponent(term)
    const res = await fetch(`https://www.steamgriddb.com/api/v2/search/autocomplete/${encoded}`, {
      headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.success && data.data?.length) return data.data[0].id
  } catch (e) { safeError('[SteamGridDB] search error', e) }
  return null
}

// Use VNDB to get English/romanized title for SteamGridDB matching
async function getVndbEnglishName(gameName) {
  try {
    const res = await fetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['search', '=', gameName],
        fields: 'title',
        results: 1,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.results?.length) return data.results[0].title
  } catch (e) { safeError('[VNDB] lookup error', e) }
  return null
}

async function fetchSteamGridDBLogos(gameName) {
  // Get English/romanized name from VNDB, then search SteamGridDB
  const enName = await getVndbEnglishName(gameName)
  const searchName = enName || gameName
  if (enName) safeLog(`[SteamGridDB] VNDB: "${gameName}" → "${enName}"`)

  const gameId = await searchSteamGridDB(searchName)
  if (!gameId) return []

  try {
    const res = await fetch(`https://www.steamgriddb.com/api/v2/logos/game/${gameId}`, {
      headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    if (data.success && data.data?.length) {
      // Prefer official style first, then fill up to 3
      const sorted = [...data.data].sort((a, b) =>
        (a.style === 'official' ? -1 : 0) - (b.style === 'official' ? -1 : 0)
      )
      return sorted.slice(0, 3).map(l => l.url || l.thumb)
    }
  } catch (e) { safeError('[SteamGridDB] logo error', e) }
  return []
}

async function downloadLogo(gameId, logoUrl, index) {
  try {
    fs.mkdirSync(logosDir, { recursive: true })
    const res = await fetch(logoUrl)
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = logoUrl.split('.').pop().split('?')[0] || 'png'
    const dest = path.join(logosDir, `${gameId}_${index}.${ext}`)
    fs.writeFileSync(dest, buf)
    return dest
  } catch (e) { safeError('[SteamGridDB] download error', e) }
  return null
}

function getCachedLogoPaths(gameId) {
  const results = []
  for (let i = 0; i < 3; i++) {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'ico']) {
      const p = path.join(logosDir, `${gameId}_${i}.${ext}`)
      if (fs.existsSync(p)) { results.push(p); break }
    }
  }
  return results
}

function clearCachedLogos(gameId) {
  for (let i = 0; i < 3; i++) {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'ico']) {
      const p = path.join(logosDir, `${gameId}_${i}.${ext}`)
      try { if (fs.existsSync(p)) fs.unlinkSync(p) } catch (_) {}
    }
  }
}

// ffmpeg bundled path
const FFMPEG_PATH = isDev
  ? path.join(__dirname, '..', 'tools', 'ffmpeg-master-latest-win64-gpl-shared', 'bin', 'ffmpeg.exe')
  : path.join(process.resourcesPath, 'tools', 'ffmpeg-master-latest-win64-gpl-shared', 'bin', 'ffmpeg.exe')

// ── config ─────────────────────────────────────────────────────
const defaultConfig = {
  libraryPath:   null,
  customNames:   {},
  selectedExes:  {},
  recentGames:   [],
  selectedMedia: {},  // { [gameId]: { videoPath, bgPath } }
  hiddenGames:   [],  // gameIds hidden from library
}

function loadConfig() {
  try {
    if (fs.existsSync(configPath))
      return { ...defaultConfig, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) }
  } catch {}
  return { ...defaultConfig }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
}

// ── game scanning ──────────────────────────────────────────────
function cleanGameName(name) {
  return name
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
}

const SKIP_EXE = new Set([
  'unins000.exe', 'uninstall.exe', 'setup.exe', 'install.exe',
  'vc_redist.x64.exe', 'vc_redist.x86.exe', 'vcredist_x64.exe', 'vcredist_x86.exe',
  'config.exe', 'menu.exe', 'patch.exe', 'update.exe', 'updater.exe',
  'dxsetup.exe', 'directx.exe', 'reg.exe', 'regsvr32.exe',
])

function findExe(dir, depth = 0) {
  if (depth > 2) return null
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const cn = entries.find(e => e.isFile() && e.name.toLowerCase().endsWith('_cn.exe'))
    if (cn) return path.join(dir, cn.name)
    const first = entries.find(e =>
      e.isFile() &&
      e.name.toLowerCase().endsWith('.exe') &&
      !SKIP_EXE.has(e.name.toLowerCase())
    )
    if (first) return path.join(dir, first.name)
    for (const e of entries.filter(e => e.isDirectory())) {
      const r = findExe(path.join(dir, e.name), depth + 1)
      if (r) return r
    }
  } catch {}
  return null
}

function findCover(dir, depth = 0) {
  if (depth > 2) return null
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const cover = entries.find(e => e.isFile() && /^cover\.(png|jpg|jpeg|webp)$/i.test(e.name))
    if (cover) return path.join(dir, cover.name)
    for (const e of entries.filter(e => e.isDirectory())) {
      const r = findCover(path.join(dir, e.name), depth + 1)
      if (r) return r
    }
  } catch {}
  return null
}

function findBg(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const bg = entries.find(e =>
      e.isFile() && /^(bg|background|banner|keyvisual|wallpaper)\.(png|jpg|jpeg|webp)$/i.test(e.name)
    )
    if (bg) return path.join(dir, bg.name)
  } catch {}
  return null
}

function getCachedCoverPath(gameId) {
  for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
    const p = path.join(coversDir, `${gameId}.${ext}`)
    if (fs.existsSync(p)) return p
  }
  return null
}

// ── video scanning (recursive) ─────────────────────────────────
const VID_EXTS   = new Set(['mp4', 'webm', 'wmv', 'mpg', 'mpeg', 'm4v', 'avi', 'flv', 'mkv'])
const VID_NATIVE = new Set(['mp4', 'webm'])

// Chromium (without MediaFoundation) only plays: MP4(H.264), WebM(VP8/VP9/AV1)
// Everything else needs transcoding
const NEVER_PLAYABLE_EXT = new Set(['wmv', 'avi', 'mpg', 'mpeg', 'flv', 'mkv', 'rmvb', 'rm'])

function isChromiumPlayable(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase()
  if (NEVER_PLAYABLE_EXT.has(ext)) return false
  try {
    const fd  = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(12)
    fs.readSync(fd, buf, 0, 12, 0)
    fs.closeSync(fd)
    if (buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0xBA) return false // MPEG-PS
    if (buf[0] === 0x47) return false // MPEG-TS
  } catch {}
  return true
}

// Get cached transcoded path for an original video
function videoCachePath(originalPath) {
  const hash = crypto.createHash('md5').update(originalPath).digest('hex')
  return path.join(videoCacheDir, hash + '.mp4')
}

// ── Transcode queue (max 1 concurrent ffmpeg) ──────────────────
let transcodeRunning = false
const transcodeQueue = []

function processTranscodeQueue() {
  if (transcodeRunning || transcodeQueue.length === 0) return
  transcodeRunning = true
  const { srcPath, resolve, reject } = transcodeQueue.shift()

  const destPath = videoCachePath(srcPath)
  if (fs.existsSync(destPath)) {
    transcodeRunning = false
    resolve(destPath)
    processTranscodeQueue()
    return
  }

  fs.mkdirSync(videoCacheDir, { recursive: true })
  const tmpPath = destPath + '.tmp.mp4'
  execFile(FFMPEG_PATH, [
    '-i', srcPath,
    '-c:v', 'libx264', '-crf', '20', '-preset', 'fast',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    '-y', tmpPath,
  ], { timeout: 300000 }, (err) => {
    transcodeRunning = false
    if (err) {
      try { fs.unlinkSync(tmpPath) } catch {}
      reject(err)
    } else {
      try { fs.renameSync(tmpPath, destPath); resolve(destPath) }
      catch (e) { reject(e) }
    }
    processTranscodeQueue()
  })
}

// Transcode a video to H.264 MP4 (queued, max 1 concurrent)
function transcodeVideo(srcPath) {
  const destPath = videoCachePath(srcPath)
  if (fs.existsSync(destPath)) return Promise.resolve(destPath)
  return new Promise((resolve, reject) => {
    transcodeQueue.push({ srcPath, resolve, reject })
    processTranscodeQueue()
  })
}
// Matches OP/opening-style filenames
const OP_RE = /^(op|opening|intro|title|pv|trailer|movie|op\d*)[^.]*\.(mp4|webm|wmv|mpg|mpeg|m4v)$|[_\-]op\d?\.(mp4|webm|wmv|mpg|mpeg|m4v)$/i

function findVideos(gameDir, maxResults = 20) {
  const results = []

  function scan(d, depth) {
    if (depth > 6 || results.length >= maxResults * 2) return
    let entries
    try { entries = fs.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.isFile()) {
        const ext = path.extname(e.name).slice(1).toLowerCase()
        if (VID_EXTS.has(ext)) {
          const fullPath = path.join(d, e.name)
          const playable = isChromiumPlayable(fullPath)
          const cached   = !playable ? videoCachePath(fullPath) : null
          results.push({
            path:         (cached && fs.existsSync(cached)) ? cached : fullPath,
            originalPath: fullPath,
            type:         'video',
            name:         e.name,
            isNative:     VID_NATIVE.has(ext),
            isOp:         OP_RE.test(e.name),
            needsTranscode: !playable && !(cached && fs.existsSync(cached)),
          })
        }
      } else if (e.isDirectory()) {
        scan(path.join(d, e.name), depth + 1)
      }
    }
  }

  scan(gameDir, 0)

  // Sort: OP-named native first → OP non-native → other native → rest
  results.sort((a, b) => {
    const rank = v => (v.isOp ? 0 : 2) + (v.isNative ? 0 : 1)
    return rank(a) - rank(b) || a.name.localeCompare(b.name)
  })

  return results.slice(0, maxResults)
}

function scanGames(libraryPath, config) {
  const games = []
  try {
    const entries = fs.readdirSync(libraryPath, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const gameDir  = path.join(libraryPath, entry.name)
      const exePath  = config.selectedExes[entry.name] || findExe(gameDir)
      if (!exePath) continue

      const localCover  = findCover(gameDir)
      const cachedCover = getCachedCoverPath(entry.name)
      const localBg    = findBg(gameDir)
      const videoFiles = findVideos(gameDir)
      const savedMedia = config.selectedMedia?.[entry.name]

      // Active video: user override → best auto-detected → null
      let videoPath = null
      if (savedMedia?.videoPath && fs.existsSync(savedMedia.videoPath)) {
        videoPath = savedMedia.videoPath
      } else if (videoFiles.length > 0) {
        videoPath = videoFiles[0].path
      }

      // Active bg: user override → local bg file → null
      let bgPath = null
      if (savedMedia?.bgPath && fs.existsSync(savedMedia.bgPath)) {
        bgPath = savedMedia.bgPath
      } else {
        bgPath = localBg || null
      }

      // Active cover: user override → local cover → Bangumi cache → null
      let coverPath = null
      if (savedMedia?.coverPath && fs.existsSync(savedMedia.coverPath)) {
        coverPath = savedMedia.coverPath
      } else {
        coverPath = localCover || cachedCover || null
      }

      // Logo: user override → first cached SteamGridDB option → null
      const logoOptions = getCachedLogoPaths(entry.name)
      let logoPath = null
      if (savedMedia?.logoPath && fs.existsSync(savedMedia.logoPath)) {
        logoPath = savedMedia.logoPath
      } else {
        logoPath = logoOptions[0] || null
      }

      // Detect wide bg (hero-style ~3:1 aspect ratio)
      let bgWide = false
      if (bgPath) {
        try {
          const { nativeImage } = require('electron')
          const img = nativeImage.createFromPath(bgPath)
          const { width, height } = img.getSize()
          if (width && height && width / height >= 2.5) bgWide = true
        } catch {}
      }

      games.push({
        id:         entry.name,
        folderName: entry.name,
        name:       config.customNames[entry.name] || cleanGameName(entry.name),
        exePath,
        coverPath,
        bgPath,
        bgWide,
        videoPath,
        videoFiles,
        logoPath,
        logoOptions,
      })
    }
  } catch (e) { safeError('scan error', e) }
  return games
}

// ── VNDB cover ─────────────────────────────────────────────────
async function fetchVndbCover(gameName) {
  try {
    const res = await fetch('https://api.vndb.org/kana/vn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: ['search', '=', gameName],
        fields: 'image.url',
        results: 1,
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.results?.length) {
      const img = data.results[0].image
      if (img?.url) return img.url
    }
  } catch (e) { safeError('[VNDB] cover error', e) }
  return null
}

async function downloadCover(gameId, url) {
  try {
    const res  = await fetch(url)
    const buf  = Buffer.from(await res.arrayBuffer())
    const ext  = url.split('.').pop().split('?')[0] || 'jpg'
    const dest = path.join(coversDir, `${gameId}.${ext}`)
    fs.writeFileSync(dest, buf)
    return dest
  } catch (e) { safeError('cover dl error', e) }
  return null
}

// ── window ──────────────────────────────────────────────────────
let mainWindow

async function createWindow() {
  fs.mkdirSync(coversDir, { recursive: true })

  mainWindow = new BrowserWindow({
    width:           1280,
    height:          800,
    minWidth:        960,
    minHeight:       600,
    frame:           false,
    resizable:       true,
    maximizable:     false,
    backgroundColor: '#171717',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
  })

  mainWindow.webContents.on('before-input-event', (_, input) => {
    if (input.key === 'F12') mainWindow.webContents.openDevTools()
  })

  if (isDev) {
    // Auto-detect Vite port (handles zombie processes hogging ports)
    const vitePort = await (async () => {
      for (let p = 5173; p < 5250; p++) {
        try {
          const res = await fetch(`http://localhost:${p}/`, { signal: AbortSignal.timeout(500) })
          if (res.ok || res.status === 304) return p
        } catch {}
      }
      return 5173
    })()
    safeLog('[Electron] loading Vite at port', vitePort)
    mainWindow.loadURL(`http://localhost:${vitePort}`)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  startMediaServer()

  // 渲染器不走代理（避免 Clash 拦截 localhost 视频请求；主进程 fetch 不受影响）
  await session.defaultSession.setProxy({ mode: 'direct' })

  // localfile:// 处理本地图片
  protocol.handle('localfile', (req) => {
    const reqUrl = new URL(req.url)
    let filePath
    if (process.platform === 'win32' && reqUrl.hostname) {
      filePath = reqUrl.hostname.toUpperCase() + ':' + decodeURIComponent(reqUrl.pathname)
    } else {
      filePath = decodeURIComponent(reqUrl.pathname).replace(/^\//, '')
    }
    return net.fetch(url.pathToFileURL(filePath).href)
  })
  createWindow()
})

app.on('window-all-closed', () => app.quit())

// ── IPC ─────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow.minimize())
ipcMain.handle('window:start-drag', () => {
  // Use native Windows API to initiate window move
  if (mainWindow && !mainWindow.isDestroyed()) {
    const { screen } = require('electron')
    const cursor = screen.getCursorScreenPoint()
    const [wx, wy] = mainWindow.getPosition()
    const offsetX = cursor.x - wx
    const offsetY = cursor.y - wy

    const moveHandler = () => {
      const pos = screen.getCursorScreenPoint()
      mainWindow.setPosition(pos.x - offsetX, pos.y - offsetY)
    }

    const interval = setInterval(moveHandler, 10)

    // Stop on mouse up — listen via polling (no native mouse up in main process)
    const checkMouse = setInterval(() => {
      // When renderer sends stop-drag, clear
    }, 50)

    // Store cleanup for stop-drag
    mainWindow._dragCleanup = () => {
      clearInterval(interval)
      clearInterval(checkMouse)
    }
  }
})
ipcMain.handle('window:stop-drag', () => {
  if (mainWindow?._dragCleanup) {
    mainWindow._dragCleanup()
    mainWindow._dragCleanup = null
  }
})
ipcMain.handle('window:maximize', () => {
  if (mainWindow.isMaximized()) {
    mainWindow.restore()
    mainWindow.setMaximizable(false)
  } else {
    mainWindow.setMaximizable(true)
    mainWindow.maximize()
    mainWindow.setMaximizable(false)
  }
})
ipcMain.handle('window:close', () => mainWindow.close())

ipcMain.handle('config:get',  ()       => loadConfig())
ipcMain.handle('config:save', (_, cfg) => saveConfig(cfg))

ipcMain.handle('library:select-folder', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择游戏库文件夹',
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('library:scan', async (_, libraryPath) => {
  return scanGames(libraryPath, loadConfig())
})

// Check if a video file is Chromium-playable
ipcMain.handle('video:is-playable', (_, filePath) => {
  return isChromiumPlayable(filePath)
})

// On-demand transcode: renderer requests when user selects a game with non-playable video
ipcMain.handle('video:request-transcode', async (_, gameId, originalPath) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('video:transcode-start', { gameId, name: path.basename(originalPath) })
  }
  try {
    const cachedPath = await transcodeVideo(originalPath)
    safeLog('[Transcode] done:', originalPath)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('video:transcoded', { gameId, originalPath, cachedPath })
    }
    return cachedPath
  } catch (e) {
    safeError('[Transcode] failed:', originalPath, e.message)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('video:transcode-failed', { gameId, name: path.basename(originalPath) })
    }
    return null
  }
})

ipcMain.handle('game:launch', (_, exePath) => {
  const cwd = path.dirname(exePath)
  spawn(exePath, [], { detached: true, stdio: 'ignore', cwd }).unref()
})

ipcMain.handle('game:select-exe', async (_, gameDir) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    defaultPath: gameDir,
    filters: [{ name: 'Executable', extensions: ['exe'] }],
    properties: ['openFile'],
    title: '选择游戏 exe',
  })
  return r.canceled ? null : r.filePaths[0]
})

ipcMain.handle('game:get-icon', async (_, exePath) => {
  try {
    const icon = await app.getFileIcon(exePath, { size: 'large' })
    return icon.toDataURL()
  } catch { return null }
})

// Save user's media selection for a game
ipcMain.handle('game:set-media', (_, gameId, { videoPath, bgPath, coverPath, logoPath }) => {
  const config = loadConfig()
  if (!config.selectedMedia) config.selectedMedia = {}
  const prev = config.selectedMedia[gameId] || {}
  config.selectedMedia[gameId] = {
    videoPath: videoPath !== undefined ? (videoPath || null) : (prev.videoPath || null),
    bgPath:    bgPath    !== undefined ? (bgPath    || null) : (prev.bgPath    || null),
    coverPath: coverPath !== undefined ? (coverPath || null) : (prev.coverPath || null),
    logoPath:  logoPath  !== undefined ? (logoPath  || null) : (prev.logoPath  || null),
  }
  saveConfig(config)
  return true
})

// Get image dimensions
ipcMain.handle('image:get-size', async (_, filePath) => {
  try {
    const { nativeImage } = require('electron')
    const img = nativeImage.createFromPath(filePath)
    const { width, height } = img.getSize()
    return { width, height }
  } catch { return null }
})

// Extract dominant vibrant color from an image (for theme color)
ipcMain.handle('image:get-dominant-color', async (_, filePath) => {
  try {
    const { nativeImage } = require('electron')
    const img = nativeImage.createFromPath(filePath).resize({ width: 50 })
    const bitmap = img.toBitmap() // BGRA format
    const { width, height } = img.getSize()

    let bestColor = null
    let bestScore = 0

    for (let i = 0; i < bitmap.length; i += 16) {
      const blue = bitmap[i], green = bitmap[i + 1], red = bitmap[i + 2]
      const max = Math.max(red, green, blue)
      const min = Math.min(red, green, blue)
      const sat = max === 0 ? 0 : (max - min) / max
      const lum = (red + green + blue) / 3
      // Prefer saturated colors that are neither too dark nor too bright
      const score = sat * (1 - Math.abs(lum / 255 - 0.45) * 1.8) * (max - min)
      if (score > bestScore) {
        bestScore = score
        bestColor = [red, green, blue]
      }
    }

    return bestColor && bestScore > 10 ? bestColor : null
  } catch { return null }
})

// Open file picker for media
ipcMain.handle('game:select-media-file', async (_, defaultPath) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || '',
    filters: [
      { name: '视频',     extensions: ['mp4', 'webm', 'wmv', 'mpg', 'mpeg', 'm4v'] },
      { name: '图片',     extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
      { name: '所有媒体', extensions: ['mp4', 'webm', 'wmv', 'mpg', 'mpeg', 'm4v', 'jpg', 'jpeg', 'png', 'webp', 'bmp'] },
    ],
    properties: ['openFile'],
    title: '选择媒体文件',
  })
  return r.canceled ? null : r.filePaths[0]
})

// Open file picker for image only
ipcMain.handle('game:select-image-file', async (_, defaultPath) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || '',
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
    ],
    properties: ['openFile'],
    title: '选择背景图片',
  })
  return r.canceled ? null : r.filePaths[0]
})

// VNDB cover fetch
ipcMain.handle('cover:fetch', async (_, gameId, gameName) => {
  const url = await fetchVndbCover(gameName)
  if (!url) return null
  return downloadCover(gameId, url)
})

// Cover fetch by URL (user-provided) — supports VNDB, Bangumi, or direct image URL
ipcMain.handle('cover:fetch-by-url', async (_, gameId, inputUrl) => {
  try {
    let imageUrl = null

    // VNDB page URL: vndb.org/v12345
    const vndbMatch = inputUrl.match(/vndb\.org\/v(\d+)/)
    // Bangumi page URL: bgm.tv/subject/12345 or bangumi.tv/subject/12345
    const bangumiMatch = inputUrl.match(/(?:bgm\.tv|bangumi\.tv)\/subject\/(\d+)/)

    if (vndbMatch) {
      const res = await fetch('https://api.vndb.org/kana/vn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: ['id', '=', 'v' + vndbMatch[1]],
          fields: 'image.url',
          results: 1,
        }),
      })
      if (!res.ok) return { error: 'VNDB API 请求失败' }
      const data = await res.json()
      if (!data.results?.length || !data.results[0].image?.url) {
        return { error: '该 VNDB 页面没有封面图片' }
      }
      imageUrl = data.results[0].image.url
    } else if (bangumiMatch) {
      const res = await fetch(`https://api.bgm.tv/v0/subjects/${bangumiMatch[1]}`, {
        headers: { 'User-Agent': 'GalgameLauncher/1.0' },
      })
      if (!res.ok) return { error: 'Bangumi API 请求失败' }
      const data = await res.json()
      const img = data.images?.large || data.images?.common
      if (!img) return { error: '该 Bangumi 页面没有封面图片' }
      imageUrl = img.startsWith('//') ? 'https:' + img : img
    } else {
      return { error: '请输入 VNDB 或 Bangumi 网址' }
    }

    const coverPath = await downloadCover(gameId, imageUrl)
    if (!coverPath) return { error: '封面下载失败' }
    return { coverPath }
  } catch (e) {
    safeError('[Cover] fetch-by-url error', e)
    return { error: '网络错误，请检查连接' }
  }
})

ipcMain.handle('cover:get-cached', (_, gameId) => getCachedCoverPath(gameId))

// Background fetch by name or SteamGridDB URL
ipcMain.handle('bg:fetch-by-input', async (_, gameId, input) => {
  try {
    fs.mkdirSync(bgsDir, { recursive: true })
    let imageUrl = null

    // SteamGridDB hero asset URL: steamgriddb.com/hero/65663
    const heroMatch = input.match(/steamgriddb\.com\/hero\/(\d+)/)
    // SteamGridDB game URL: steamgriddb.com/game/12345 or steamgriddb.com/game/12345/heroes
    const gameUrlMatch = input.match(/steamgriddb\.com\/game\/(\d+)/)

    if (heroMatch) {
      // Direct hero asset — fetch the asset info by ID
      const res = await fetch(`https://www.steamgriddb.com/api/v2/heroes/${heroMatch[1]}`, {
        headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
      })
      if (!res.ok) return { error: 'SteamGridDB API 请求失败' }
      const data = await res.json()
      if (!data.success || !data.data) return { error: '未找到该 Hero 资源' }
      imageUrl = data.data.url || data.data.thumb
    } else if (gameUrlMatch) {
      // Game page — fetch first hero for this game
      const res = await fetch(`https://www.steamgriddb.com/api/v2/heroes/game/${gameUrlMatch[1]}`, {
        headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
      })
      if (!res.ok) return { error: 'SteamGridDB API 请求失败' }
      const data = await res.json()
      if (!data.success || !data.data?.length) return { error: '该游戏没有可用的 Hero 背景图' }
      imageUrl = data.data[0].url || data.data[0].thumb
    } else {
      // Treat as game name search
      const sgdbId = await searchSteamGridDB(input)
      if (!sgdbId) return { error: `在 SteamGridDB 上未找到 "${input}"` }
      const res = await fetch(`https://www.steamgriddb.com/api/v2/heroes/game/${sgdbId}`, {
        headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
      })
      if (!res.ok) return { error: 'SteamGridDB API 请求失败' }
      const data = await res.json()
      if (!data.success || !data.data?.length) return { error: '该游戏没有可用的 Hero 背景图' }
      imageUrl = data.data[0].url || data.data[0].thumb
    }

    if (!imageUrl) return { error: '未找到背景图' }
    // Download
    const res = await fetch(imageUrl)
    const buf = Buffer.from(await res.arrayBuffer())
    const ext = imageUrl.split('.').pop().split('?')[0] || 'jpg'
    const dest = path.join(bgsDir, `${gameId}.${ext}`)
    fs.writeFileSync(dest, buf)
    // Detect wide
    const { nativeImage } = require('electron')
    const img = nativeImage.createFromPath(dest)
    const { width, height } = img.getSize()
    const bgWide = width && height && width / height >= 2.5
    return { bgPath: dest, bgWide }
  } catch (e) {
    safeError('[BG] fetch-by-input error', e)
    return { error: '下载失败，请检查网址或网络' }
  }
})

ipcMain.handle('media:get-port', () => mediaPort)

// SteamGridDB logo — download up to 3 options, return array of paths
ipcMain.handle('logo:fetch', async (_, gameId, gameName) => {
  const urls = await fetchSteamGridDBLogos(gameName)
  if (!urls.length) return []
  const paths = []
  for (let i = 0; i < urls.length; i++) {
    const p = await downloadLogo(gameId, urls[i], i)
    if (p) paths.push(p)
  }
  return paths
})

ipcMain.handle('logo:get-options', (_, gameId) => getCachedLogoPaths(gameId))

// Logo fetch by name or SteamGridDB URL
ipcMain.handle('logo:fetch-by-name', async (_, gameId, input) => {
  try {
    let sgdbId = null
    // SteamGridDB URL: steamgriddb.com/game/12345 or steamgriddb.com/game/12345/logos
    const urlMatch = input.match(/steamgriddb\.com\/game\/(\d+)/)
    if (urlMatch) {
      sgdbId = parseInt(urlMatch[1])
    } else {
      // Treat as search term
      sgdbId = await searchSteamGridDB(input)
      if (!sgdbId) return { error: `在 SteamGridDB 上未找到 "${input}"` }
    }
    const res = await fetch(`https://www.steamgriddb.com/api/v2/logos/game/${sgdbId}`, {
      headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
    })
    if (!res.ok) return { error: 'SteamGridDB API 请求失败' }
    const data = await res.json()
    if (!data.success || !data.data?.length) return { error: '该游戏没有可用的 Logo' }
    const sorted = [...data.data].sort((a, b) =>
      (a.style === 'official' ? -1 : 0) - (b.style === 'official' ? -1 : 0)
    )
    const urls = sorted.slice(0, 3).map(l => l.url || l.thumb)
    // Clear old logos before downloading new ones
    clearCachedLogos(gameId)
    const paths = []
    for (let i = 0; i < urls.length; i++) {
      const p = await downloadLogo(gameId, urls[i], i)
      if (p) paths.push(p)
    }
    if (!paths.length) return { error: 'Logo 下载失败' }
    return { paths }
  } catch (e) {
    safeError('[SteamGridDB] fetch-by-name error', e)
    return { error: '网络错误，请检查连接' }
  }
})

// Reset all custom settings for a game, return re-scanned game data
ipcMain.handle('game:reset-custom', async (_, gameId) => {
  const config = loadConfig()

  // Clear all custom overrides
  delete config.customNames[gameId]
  delete config.selectedExes[gameId]
  if (config.selectedMedia) delete config.selectedMedia[gameId]
  saveConfig(config)

  // Re-scan this single game to get auto-detected values
  if (!config.libraryPath) return null
  const gameDir = path.join(config.libraryPath, gameId)
  if (!fs.existsSync(gameDir)) return null

  const exePath    = findExe(gameDir)
  const localCover = findCover(gameDir)
  const cachedCover = getCachedCoverPath(gameId)
  const localBg    = findBg(gameDir)
  const videoFiles = findVideos(gameDir)
  const logoOptions = getCachedLogoPaths(gameId)

  return {
    id:         gameId,
    folderName: gameId,
    name:       cleanGameName(gameId),
    exePath:    exePath || null,
    coverPath:  localCover || cachedCover || null,
    bgPath:     localBg || null,
    bgWide:     (() => {
      const bg = localBg
      if (!bg) return false
      try {
        const { nativeImage } = require('electron')
        const img = nativeImage.createFromPath(bg)
        const { width, height } = img.getSize()
        return width && height && width / height >= 2.5
      } catch { return false }
    })(),
    videoPath:  videoFiles.length > 0 ? videoFiles[0].path : null,
    videoFiles,
    logoPath:   logoOptions[0] || null,
    logoOptions,
  }
})

// Select logo image file
ipcMain.handle('game:select-logo-file', async (_, defaultPath) => {
  const r = await dialog.showOpenDialog(mainWindow, {
    defaultPath: defaultPath || '',
    filters: [
      { name: '图片', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] },
    ],
    properties: ['openFile'],
    title: '选择 Logo 图片',
  })
  return r.canceled ? null : r.filePaths[0]
})

