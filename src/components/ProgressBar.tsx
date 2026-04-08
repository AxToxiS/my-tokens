interface ProgressBarProps {
  value: number
  max: number
  color?: string
  label?: string
  showFraction?: boolean
}

export default function ProgressBar({
  value,
  max,
  color = '#3b82f6',
  label,
  showFraction = true,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0
  // value = remaining (100=full, 0=depleted) → red when LOW (<20%)
  const isLow = percentage < 20
  const barColor = isLow ? '#ef4444' : color

  return (
    <div className="w-full">
      {(label || showFraction) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              {label}
            </span>
          )}
          {showFraction && (
            <span className={`text-[10px] font-mono ${isLow ? 'text-red-400' : 'text-zinc-400'}`}>
              {Math.round(percentage)}% restante
            </span>
          )}
        </div>
      )}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  )
}
