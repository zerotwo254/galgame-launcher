const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  window: {
    minimize:  () => ipcRenderer.invoke('window:minimize'),
    maximize:  () => ipcRenderer.invoke('window:maximize'),
    close:     () => ipcRenderer.invoke('window:close'),
    startDrag: () => ipcRenderer.invoke('window:start-drag'),
    stopDrag:  () => ipcRenderer.invoke('window:stop-drag'),
  },
  config: {
    get:  ()      => ipcRenderer.invoke('config:get'),
    save: (cfg)   => ipcRenderer.invoke('config:save', cfg),
  },
  library: {
    selectFolder: ()    => ipcRenderer.invoke('library:select-folder'),
    scan:         (p)   => ipcRenderer.invoke('library:scan', p),
  },
  game: {
    launch:          (exePath)       => ipcRenderer.invoke('game:launch', exePath),
    selectExe:       (gameDir)       => ipcRenderer.invoke('game:select-exe', gameDir),
    getIcon:         (exePath)       => ipcRenderer.invoke('game:get-icon', exePath),
    setMedia:        (id, media)     => ipcRenderer.invoke('game:set-media', id, media),
    selectMediaFile: (defaultPath)   => ipcRenderer.invoke('game:select-media-file', defaultPath),
    selectImageFile: (defaultPath)   => ipcRenderer.invoke('game:select-image-file', defaultPath),
    selectLogoFile:  (defaultPath)   => ipcRenderer.invoke('game:select-logo-file', defaultPath),
    resetCustom:     (gameId)        => ipcRenderer.invoke('game:reset-custom', gameId),
  },
  image: {
    getSize: (filePath) => ipcRenderer.invoke('image:get-size', filePath),
    getDominantColor: (filePath) => ipcRenderer.invoke('image:get-dominant-color', filePath),
  },
  bg: {
    fetchByInput: (id, input) => ipcRenderer.invoke('bg:fetch-by-input', id, input),
  },
  cover: {
    fetch:      (id, name) => ipcRenderer.invoke('cover:fetch', id, name),
    fetchByUrl: (id, url)  => ipcRenderer.invoke('cover:fetch-by-url', id, url),
    getCached:  (id)       => ipcRenderer.invoke('cover:get-cached', id),
  },
  logo: {
    fetch:       (id, name) => ipcRenderer.invoke('logo:fetch', id, name),
    fetchByName: (id, name) => ipcRenderer.invoke('logo:fetch-by-name', id, name),
    getOptions:  (id)       => ipcRenderer.invoke('logo:get-options', id),
  },
  media: {
    getPort: () => ipcRenderer.invoke('media:get-port'),
    isPlayable:       (filePath) => ipcRenderer.invoke('video:is-playable', filePath),
    requestTranscode: (gameId, originalPath) => ipcRenderer.invoke('video:request-transcode', gameId, originalPath),
    onTranscoded: (cb) => {
      ipcRenderer.on('video:transcoded', (_, data) => cb(data))
    },
    onTranscodeStart: (cb) => {
      ipcRenderer.on('video:transcode-start', (_, data) => cb(data))
    },
    onTranscodeFailed: (cb) => {
      ipcRenderer.on('video:transcode-failed', (_, data) => cb(data))
    },
  },
})
