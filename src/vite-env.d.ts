/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    scrapeService: (service: string) => Promise<ServiceData | null>
    scrapeAllServices: () => Promise<Record<string, ServiceData | null>>
    openServiceLogin: (service: string) => Promise<void>
    onServiceLoginClosed: (callback: (service: string) => void) => void
    getSettings: () => Promise<AppSettings>
    saveSettings: (settings: AppSettings) => Promise<void>
    minimizeWindow: () => void
    closeWindow: () => void
  }
}

interface ServiceData {
  service: string
  fiveHourUsage?: number
  fiveHourLimit?: number
  weeklyUsage?: number
  weeklyLimit?: number
  premiumRequests?: number
  premiumRequestsLimit?: number
  tokensUsed?: number
  tokensLimit?: number
  creditsUsed?: number
  creditsLimit?: number
  linesWritten?: number
  lastUpdated: number
  error?: string
  rawNumbers?: string[]
  rawPercentages?: string[]
  progressElements?: Array<{ value: string | null; max: string | null; text: string }>
  copilotSection?: string[]
  pageTitle?: string
  bodyPreview?: string
  [key: string]: any
}

interface AppSettings {
  refreshIntervalMinutes: number
  browser: 'chrome' | 'edge' | 'firefox'
  githubPAT?: string
  githubUsername?: string
  openaiPlan: 'plus' | 'pro'
  claudePlan: 'pro' | 'max5x' | 'max20x'
}
