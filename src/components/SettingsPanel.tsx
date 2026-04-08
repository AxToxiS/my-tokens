const ALL_SERVICES = [
  { id: 'openai', name: 'OpenAI', color: '#10b981' },
  { id: 'claude', name: 'Claude', color: '#d97706' },
  { id: 'github', name: 'Copilot', color: '#3b82f6' },
  { id: 'windsurf', name: 'Windsurf', color: '#a855f7' },
]

interface SettingsPanelProps {
  opacity: number
  visibleServices: string[]
  onOpacityChange: (v: number) => void
  onVisibleServicesChange: (services: string[]) => void
}

export default function SettingsPanel({
  opacity,
  visibleServices,
  onOpacityChange,
  onVisibleServicesChange,
}: SettingsPanelProps) {
  const toggleService = (id: string) => {
    if (visibleServices.includes(id)) {
      // Don't allow deselecting all
      if (visibleServices.length <= 1) return
      onVisibleServicesChange(visibleServices.filter((s) => s !== id))
    } else {
      onVisibleServicesChange([...visibleServices, id])
    }
  }

  return (
    <div className="px-2.5 py-2 space-y-2.5">
      {/* Transparency */}
      <div>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[8px] text-zinc-400 uppercase tracking-wider">Transparencia</span>
          <span className="text-[8px] font-mono text-zinc-400">{Math.round(opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
          className="w-full h-1 appearance-none bg-zinc-700 rounded cursor-pointer accent-purple-500"
        />
      </div>

      {/* Providers */}
      <div>
        <span className="text-[8px] text-zinc-400 uppercase tracking-wider block mb-0.5">Proveedores</span>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {ALL_SERVICES.map(({ id, name, color }) => (
            <label key={id} className="flex items-center gap-1 cursor-pointer group">
              <input
                type="checkbox"
                checked={visibleServices.includes(id)}
                onChange={() => toggleService(id)}
                className="w-2.5 h-2.5 cursor-pointer accent-purple-500"
              />
              <span
                className="text-[8px] font-medium"
                style={{ color: visibleServices.includes(id) ? color : '#52525b' }}
              >
                {name}
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
