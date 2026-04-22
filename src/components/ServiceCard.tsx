import ProgressBar from './ProgressBar'
import PeakIndicator from './PeakIndicator'

interface ServiceCardProps {
  service: string
  data: ServiceData | null
  isLoading: boolean
  onLogin: () => void
  onRefresh: () => void
  onLogout: () => void
}

const SERVICE_CONFIG: Record<string, { name: string; color: string; icon: string }> = {
  openai: { name: 'OpenAI', color: '#10b981', icon: '◆' },
  claude: { name: 'Claude', color: '#d97706', icon: '◈' },
}

function formatResetTime(minutes: number): string {
  if (minutes <= 0) return 'Resets soon'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `Resets in ${h} hr ${m} min`
  if (h > 0) return `Resets in ${h} hr`
  return `Resets in ${m} min`
}

function renderServiceBars(service: string, data: ServiceData, color: string) {
  switch (service) {
    case 'openai':
      return (
        <div className="space-y-1">
          {data.fiveHourUsage != null && data.fiveHourLimit != null && (
            <ProgressBar value={data.fiveHourUsage} max={data.fiveHourLimit} color={color} label="5 hours" />
          )}
          {data.weeklyUsage != null && data.weeklyLimit != null && (
            <ProgressBar value={data.weeklyUsage} max={data.weeklyLimit} color={color} label="Weekly" />
          )}
        </div>
      )

    case 'claude': {
      const hasClaudeCode = data.claudeCodeUsage != null && data.claudeCodeLimit != null
      return (
        <div className="space-y-1">
          {data.fiveHourUsage != null && data.fiveHourLimit != null && (
            <div>
              <ProgressBar value={data.fiveHourUsage} max={data.fiveHourLimit} color={color} label="Session" />
              {data.sessionResetInMinutes != null && (
                <div className="text-[7px] text-zinc-500 mt-0.5">
                  {formatResetTime(data.sessionResetInMinutes)}
                </div>
              )}
            </div>
          )}
          {data.weeklyUsage != null && data.weeklyLimit != null && (
            <ProgressBar value={data.weeklyUsage} max={data.weeklyLimit} color={color} label="Weekly" />
          )}
          {hasClaudeCode ? (
            <ProgressBar
              value={data.claudeCodeUsage!}
              max={data.claudeCodeLimit!}
              color={color}
              label="Claude Code"
            />
          ) : (
            <div className="pt-0.5">
              <span className="text-[8px] text-zinc-500 uppercase tracking-wider block mb-0.5">Claude Code</span>
              <div className="text-[8px] text-zinc-500 bg-zinc-800/50 rounded px-1 py-0.5">
                You haven't used Claude Code yet
              </div>
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
  onLogout,
}: ServiceCardProps) {
  const config = SERVICE_CONFIG[service] || { name: service, color: '#71717a', icon: '○' }
  const hasError = data?.error
  const hasNoData = data && !hasError &&
    data.fiveHourUsage == null &&
    data.weeklyUsage == null &&
    data.claudeCodeUsage == null
  // Show login when: no data yet (and not loading), scrape errored, or scrape returned empty
  const needsLogin = !isLoading && (!data || hasError || hasNoData)

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
          {needsLogin ? (
            <button
              onClick={onLogin}
              className="text-[8px] px-1.5 py-0 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors"
            >
              Login
            </button>
          ) : data && !hasError ? (
            <button
              onClick={onLogout}
              title="Sign out"
              className="w-4 h-4 rounded flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-zinc-700 transition-colors"
            >
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                <path d="M6.5 3.5V2a.5.5 0 00-.5-.5H2A.5.5 0 001.5 2v6a.5.5 0 00.5.5h4a.5.5 0 00.5-.5V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M5 5h3.5M7 3.5L8.5 5 7 6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ) : null}
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
      ) : isLoading ? (
        <div className="text-[8px] text-zinc-500">...</div>
      ) : (
        <div className="text-[8px] text-zinc-500 bg-zinc-800/50 rounded p-1">
          Requires login
        </div>
      )}
    </div>
  )
}
