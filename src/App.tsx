import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import TitleBar from './components/TitleBar'
import ServiceCard from './components/ServiceCard'
import SettingsPanel from './components/SettingsPanel'

const ALL_SERVICES = ['openai', 'claude', 'github', 'windsurf']

function loadUISettings() {
  try {
    const raw = localStorage.getItem('my-tokens-ui')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { opacity: 1.0, visibleServices: ALL_SERVICES }
}

function saveUISettings(settings: { opacity: number; visibleServices: string[] }) {
  localStorage.setItem('my-tokens-ui', JSON.stringify(settings))
}

export default function App() {
  const [serviceData, setServiceData] = useState<Record<string, ServiceData | null>>({})
  const [loadingServices, setLoadingServices] = useState<Set<string>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [uiSettings, setUISettings] = useState(loadUISettings)
  const didInit = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  // Apply opacity on mount and when changed
  useEffect(() => {
    window.electronAPI.setOpacity(uiSettings.opacity)
  }, [uiSettings.opacity])

  const updateUISettings = useCallback((patch: Partial<typeof uiSettings>) => {
    setUISettings((prev: typeof uiSettings) => {
      const next = { ...prev, ...patch }
      saveUISettings(next)
      return next
    })
  }, [])

  const refreshService = useCallback(async (service: string) => {
    setLoadingServices((prev) => new Set(prev).add(service))
    try {
      const data = await window.electronAPI.scrapeService(service)
      // Don't overwrite existing data with null (happens when a concurrent scrape is skipped)
      if (data !== null) {
        setServiceData((prev) => ({ ...prev, [service]: data }))
      }
    } catch (err) {
      console.error(`Error refreshing ${service}:`, err)
    } finally {
      setLoadingServices((prev) => {
        const next = new Set(prev)
        next.delete(service)
        return next
      })
    }
  }, [])

  const refreshAll = useCallback(async () => {
    await Promise.all(uiSettings.visibleServices.map((s: string) => refreshService(s)))
    setLastRefresh(new Date().toLocaleTimeString())
  }, [refreshService, uiSettings.visibleServices])

  const handleLogin = useCallback(async (service: string) => {
    await window.electronAPI.openServiceLogin(service)
  }, [])

  const handleLogout = useCallback(async (service: string) => {
    await window.electronAPI.logoutService(service)
    setServiceData((prev) => ({ ...prev, [service]: null }))
  }, [])

  // Auto-refresh after login window closes
  useEffect(() => {
    window.electronAPI.onServiceLoginClosed((service: string) => {
      console.log(`Login closed for ${service}, refreshing...`)
      refreshService(service)
    })
  }, [refreshService])

  // Listen for push updates from main process
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    window.electronAPI.onServiceDataUpdate((data: ServiceData) => {
      console.log(`[UI] data for ${data.service}:`, JSON.stringify(data))
      setServiceData((prev) => ({ ...prev, [data.service]: data }))
      setLastRefresh(new Date().toLocaleTimeString())
    })
  }, [])

  // Resize Electron window to match content
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      window.electronAPI.resizeWindow(el.scrollHeight)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const visibleServices = ALL_SERVICES.filter((s) => uiSettings.visibleServices.includes(s))

  return (
    <div ref={rootRef} className="w-full bg-[#1a1b23] rounded-lg overflow-hidden flex flex-col border border-zinc-800/50">
      <TitleBar
        settingsOpen={settingsOpen}
        onSettingsToggle={() => setSettingsOpen((v) => !v)}
      />

      {/* Settings modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-[#1e1f29] border border-zinc-700/60 rounded-lg shadow-xl w-52 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-zinc-700/50">
              <span className="text-[9px] font-semibold text-zinc-300 uppercase tracking-wider">Ajustes</span>
              <button
                onClick={() => setSettingsOpen(false)}
                className="w-4 h-4 rounded flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <SettingsPanel
              opacity={uiSettings.opacity}
              visibleServices={uiSettings.visibleServices}
              onOpacityChange={(v) => updateUISettings({ opacity: v })}
              onVisibleServicesChange={(services) => updateUISettings({ visibleServices: services })}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 p-1 space-y-1">
        {visibleServices.map((service) => (
          <ServiceCard
            key={service}
            service={service}
            data={serviceData[service] || null}
            isLoading={loadingServices.has(service)}
            onLogin={() => handleLogin(service)}
            onRefresh={() => refreshService(service)}
            onLogout={() => handleLogout(service)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 bg-[#1a1b23] border-t border-zinc-800/50 flex items-center justify-between">
        <span className="text-[8px] text-zinc-600">
          {lastRefresh ? `Último: ${lastRefresh}` : '...'}
        </span>
        <span className="text-[8px] text-zinc-600">
          auto: 30s
        </span>
      </div>
    </div>
  )
}
