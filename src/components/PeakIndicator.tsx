import { useState, useEffect } from 'react'

interface PeakStatus {
  isPeak: boolean
  label: string
  nextChangeIn: string
  nextChangeLabel: string
}

function getPeakStatus(): PeakStatus {
  const now = new Date()

  // Convert to Pacific Time
  const ptString = now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
  const ptDate = new Date(ptString)
  const ptHour = ptDate.getHours()

  // Peak hours: 05:00 - 11:00 PT
  const isPeak = ptHour >= 5 && ptHour < 11

  // Calculate next change
  let nextChangeHourPT: number
  if (isPeak) {
    nextChangeHourPT = 11 // Off-peak starts at 11 PT
  } else {
    nextChangeHourPT = 5 // Peak starts at 5 PT
  }

  // Calculate time until next change
  const ptNow = new Date(ptString)
  const ptNext = new Date(ptString)
  ptNext.setHours(nextChangeHourPT, 0, 0, 0)

  if (ptNext <= ptNow) {
    ptNext.setDate(ptNext.getDate() + 1)
  }

  const diffMs = ptNext.getTime() - ptNow.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  const nextChangeIn =
    diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`

  return {
    isPeak,
    label: isPeak ? 'PEAK' : 'OFF-PEAK',
    nextChangeIn,
    nextChangeLabel: isPeak ? 'Off-peak in' : 'Peak in',
  }
}

export default function PeakIndicator() {
  const [status, setStatus] = useState<PeakStatus>(getPeakStatus())

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getPeakStatus())
    }, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-medium ${
        status.isPeak
          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      }`}
    >
      <div
        className={`w-1.5 h-1.5 rounded-full ${
          status.isPeak ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
        }`}
      />
      <span>{status.label}</span>
      <span className="text-zinc-500">|</span>
      <span className="text-zinc-400">
        {status.nextChangeLabel} {status.nextChangeIn}
      </span>
    </div>
  )
}
