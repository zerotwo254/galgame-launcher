export default function WindowControls() {
  return (
    <div className="no-drag fixed top-0 right-0 flex z-50">
      <button
        onClick={() => window.api.window.minimize()}
        className="w-11 h-9 flex items-center justify-center
                   hover:bg-white/10 transition-colors text-white/50 hover:text-white"
        title="最小化"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        onClick={() => window.api.window.maximize()}
        className="w-11 h-9 flex items-center justify-center
                   hover:bg-white/10 transition-colors text-white/50 hover:text-white"
        title="最大化"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        onClick={() => window.api.window.close()}
        className="w-11 h-9 flex items-center justify-center
                   hover:bg-red-600 transition-colors text-white/50 hover:text-white"
        title="关闭"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
          <line x1="0" y1="0" x2="10" y2="10" />
          <line x1="10" y1="0" x2="0" y2="10" />
        </svg>
      </button>
    </div>
  )
}
