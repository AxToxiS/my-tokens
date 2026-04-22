/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    scrapeService: (service: string) => Promise<ServiceData | null>
    scrapeAllServices: () => Promise<Record<string, ServiceData | null>>
    openServiceLogin: (service: string) => Promise<void>
    logoutService: (service: string) => Promise<void>
    onServiceLoginClosed: (callback: (service: string) => void) => void
    onServiceDataUpdate: (callback: (data: ServiceData) => void) => void
    minimizeWindow: () => void
    closeWindow: () => void
    resizeWindow: (height: number) => void
    setOpacity: (opacity: number) => void
  }
}

interface ServiceData {
  service: string
  fiveHourUsage?: number
  fiveHourLimit?: number
  weeklyUsage?: number
  weeklyLimit?: number
  claudeDesignUsage?: number
  claudeDesignLimit?: number
  sessionResetInMinutes?: number
  lastUpdated: number
  error?: string
  rawNumbers?: string[]
  rawPercentages?: string[]
  pageTitle?: string
  bodyPreview?: string
  [key: string]: any
}

interface AppSettings {
  refreshIntervalMinutes: number
  browser: 'chrome' | 'edge' | 'firefox'
  openaiPlan: 'plus' | 'pro'
  claudePlan: 'pro' | 'max5x' | 'max20x'
}
