import ProgressBar from './ProgressBar'
import PeakIndicator from './PeakIndicator'

interface ServiceCardProps {
  service: string
  data: ServiceData | null
  isLoading: boolean
  onLogin: () => void
  onRefresh: () => void
}

const SERVICE_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  openai: { name: 'OpenAI', color: '#10b981', icon: '◆' },
  claude: { name: 'Claude', color: '#d97706', icon: '◈' },
  github: { name: 'Copilot', color: '#3b82f6', icon: '◉' },
  windsurf: { name: 'Windsurf', color: '#a855f7', icon: '◎' },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function renderServiceBars(service: string, data: ServiceData, color: string) {
  switch (service) {
    case 'openai':
    case 'claude':
      return (
        <div className="space-y-2">
          {data.fiveHourUsage != null && data.fiveHourLimit != null && (
            <ProgressBar
              value={data.fiveHourUsage}
              max={data.fiveHourLimit}
              color={color}
              label="Cuota 5 horas"
            />
          )}
          {data.weeklyUsage != null && data.weeklyLimit != null && (
            <ProgressBar
              value={data.weeklyUsage}
              max={data.weeklyLimit}
              color={color}
              label="Cuota semanal"
            />
          )}
        </div>
      )

    case 'github': {
      // GitHub: premiumRequests = remaining % (already 100 - used%)
      return (
        <div className="space-y-2">
          {data.premiumRequests != null && data.premiumRequestsLimit != null && (
            <ProgressBar
              value={data.premiumRequests}
              max={data.premiumRequestsLimit}
              color={color}
              label="Premium requests"
            />
          )}
        </div>
      )
    }

    case 'windsurf': {
      // Windsurf Enterprise: shows total credits used (no limit available)
      return (
        <div className="space-y-1">
          {data.creditsUsed != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Créditos usados
              </span>
              <span className="text-[10px] font-mono text-zinc-300">
                {data.creditsUsed.toLocaleString()}
              </span>
            </div>
          )}
          {data.linesWritten != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                Líneas por Cascade
              </span>
              <span className="text-[10px] font-mono text-zinc-400">
                {data.linesWritten.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )
    }

    default:
      return null
  }
}

export default function ServiceCard({
  service,
  data,
  isLoading,
  onLogin,
  onRefresh,
}: ServiceCardProps) {
  const config = SERVICE_CONFIG[service] || { name: service, color: '#71717a', icon: '○' }
  const hasError = data?.error
  const hasNoData = data && !hasError &&
    data.fiveHourUsage == null &&
    data.weeklyUsage == null &&
    data.premiumRequests == null &&
    data.tokensUsed == null &&
    data.creditsUsed == null
  const needsLogin = hasError || hasNoData

  return (
    <div className="bg-[#22232d] rounded-lg p-3 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: config.color }} className="text-sm">
            {config.icon}
          </span>
          <span className="text-sm font-medium text-zinc-200">{config.name}</span>
          {isLoading && (
            <div className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {needsLogin && (
            <button
              onClick={onLogin}
              className="text-[10px] px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Login
            </button>
          )}
          <button
            onClick={onRefresh}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-0.5"
            title="Refrescar"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M10 6a4 4 0 1 1-.5-1.9"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
              <path d="M10 2v2.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Peak indicator for Claude */}
      {service === 'claude' && (
        <div className="mb-2">
          <PeakIndicator />
        </div>
      )}

      {/* Content */}
      {data && !hasError && !hasNoData ? (
        <div className="space-y-2">
          {renderServiceBars(service, data, config.color)}
          <div className="text-[9px] text-zinc-600 text-right">
            {new Date(data.lastUpdated).toLocaleTimeString()}
          </div>
        </div>
      ) : data && (hasError || hasNoData) ? (
        <div className="text-[10px] text-zinc-500 bg-zinc-800/50 rounded p-2 space-y-1">
          <div>Requiere login — pulsa el botón Login arriba</div>
          {data.pageTitle && (
            <div className="text-[9px] text-zinc-600 truncate">Página: {data.pageTitle}</div>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-zinc-500">
          {isLoading ? 'Cargando...' : 'Sin datos'}
        </div>
      )}
    </div>
  )
}
