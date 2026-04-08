import { useState } from 'react'

interface TitleBarProps {
  settingsOpen: boolean
  onSettingsToggle: () => void
}

export default function TitleBar({ settingsOpen, onSettingsToggle }: TitleBarProps) {
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
        {/* Settings */}
        <button
          onClick={onSettingsToggle}
          onMouseEnter={() => setIsHovered('settings')}
          onMouseLeave={() => setIsHovered(null)}
          className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
            settingsOpen || isHovered === 'settings' ? 'bg-zinc-700' : 'bg-transparent'
          }`}
          title="Ajustes"
        >
          <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 9a2 2 0 100-4 2 2 0 000 4z"
              stroke={settingsOpen ? '#c084fc' : '#a1a1aa'}
              strokeWidth="1.4"
            />
            <path
              d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06"
              stroke={settingsOpen ? '#c084fc' : '#a1a1aa'}
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {/* Minimize */}
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
        {/* Close */}
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
