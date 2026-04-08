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
      return (
        <div className="space-y-1">
          {data.fiveHourUsage != null && data.fiveHourLimit != null && (
            <ProgressBar value={data.fiveHourUsage} max={data.fiveHourLimit} color={color} label="5 horas" />
          )}
          {data.weeklyUsage != null && data.weeklyLimit != null && (
            <ProgressBar value={data.weeklyUsage} max={data.weeklyLimit} color={color} label="Semanal" />
          )}
        </div>
      )

    case 'claude':
      return (
        <div className="space-y-1">
          {data.fiveHourUsage != null && data.fiveHourLimit != null && (
            <ProgressBar value={data.fiveHourUsage} max={data.fiveHourLimit} color={color} label="Sesión" />
          )}
          {data.weeklyUsage != null && data.weeklyLimit != null && (
            <ProgressBar value={data.weeklyUsage} max={data.weeklyLimit} color={color} label="Semanal" />
          )}
        </div>
      )

    case 'github': {
      // GitHub: premiumRequests = remaining % (already 100 - used%)
      return (
        <div className="space-y-1">
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
              <span className="text-[8px] text-zinc-500 uppercase tracking-wider">
                Créditos
              </span>
              <span className="text-[8px] font-mono text-zinc-300">
                {data.creditsUsed.toLocaleString()}
              </span>
            </div>
          )}
          {data.linesWritten != null && (
            <div className="flex items-center justify-between">
              <span className="text-[8px] text-zinc-500 uppercase tracking-wider">
                Líneas Cascade
              </span>
              <span className="text-[8px] font-mono text-zinc-400">
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
    <div className="bg-[#22232d] rounded p-1.5 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span style={{ color: config.color }} className="text-[10px]">
            {config.icon}
          </span>
          <span className="text-[10px] font-medium text-zinc-200">{config.name}</span>
          {isLoading && (
            <div className="w-2 h-2 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {needsLogin && (
            <button
              onClick={onLogin}
              className="text-[8px] px-1.5 py-0 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Login
            </button>
          )}
        </div>
      </div>

      {/* Peak indicator for Claude */}
      {service === 'claude' && (
        <div className="mb-1">
          <PeakIndicator />
        </div>
      )}

      {/* Content */}
      {data && !hasError && !hasNoData ? (
        <div className="space-y-1">
          {renderServiceBars(service, data, config.color)}
        </div>
      ) : data && (hasError || hasNoData) ? (
        <div className="text-[8px] text-zinc-500 bg-zinc-800/50 rounded p-1">
          Requiere login
        </div>
      ) : (
        <div className="text-[8px] text-zinc-500">
          {isLoading ? '...' : 'Sin datos'}
        </div>
      )}
    </div>
  )
}
