import { useState } from 'react'

export default function TitleBar() {
  const [isHovered, setIsHovered] = useState<string | null>(null)

  return (
    <div
      className="flex items-center justify-between px-2 py-1 bg-[#1a1b23] rounded-t-lg"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        <span className="text-[9px] font-semibold text-zinc-400 tracking-wide uppercase">
          My Tokens
        </span>
      </div>
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          onMouseEnter={() => setIsHovered('min')}
          onMouseLeave={() => setIsHovered(null)}
          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
            isHovered === 'min' ? 'bg-zinc-700' : 'bg-transparent'
          }`}
        >
          <svg width="8" height="1" viewBox="0 0 10 1" fill="none">
            <rect width="10" height="1" rx="0.5" fill="#a1a1aa" />
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          onMouseEnter={() => setIsHovered('close')}
          onMouseLeave={() => setIsHovered(null)}
          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
            isHovered === 'close' ? 'bg-red-500/30' : 'bg-transparent'
          }`}
        >
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
            <path d="M1 1L9 9M9 1L1 9" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
