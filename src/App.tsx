import { useState, useEffect, useCallback, useRef } from 'react'
import TitleBar from './components/TitleBar'
import ServiceCard from './components/ServiceCard'

const SERVICES = ['openai', 'claude', 'github', 'windsurf']
const REFRESH_INTERVAL = 5 * 1000 // 5 seconds

export default function App() {
  const [serviceData, setServiceData] = useState<Record<string, ServiceData | null>>({})
  const [loadingServices, setLoadingServices] = useState<Set<string>>(new Set())
  const didInit = useRef(false)

  const refreshService = useCallback(async (service: string) => {
    setLoadingServices((prev) => new Set(prev).add(service))
    try {
      const data = await window.electronAPI.scrapeService(service)
      setServiceData((prev) => ({ ...prev, [service]: data }))
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
    for (const service of SERVICES) {
      await refreshService(service)
    }
  }, [refreshService])

  const handleLogin = useCallback(async (service: string) => {
    await window.electronAPI.openServiceLogin(service)
  }, [])

  // Auto-refresh after login window closes
  useEffect(() => {
    window.electronAPI.onServiceLoginClosed((service: string) => {
      console.log(`Login closed for ${service}, refreshing...`)
      refreshService(service)
    })
  }, [refreshService])

  // Initial load + periodic refresh (guard against StrictMode double-call)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    refreshAll()
    const interval = setInterval(refreshAll, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [refreshAll])

  return (
    <div className="w-full h-screen bg-[#1a1b23] rounded-lg overflow-hidden flex flex-col border border-zinc-800/50">
      <TitleBar />

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-1 space-y-1">
        {SERVICES.map((service) => (
          <ServiceCard
            key={service}
            service={service}
            data={serviceData[service] || null}
            isLoading={loadingServices.has(service)}
            onLogin={() => handleLogin(service)}
            onRefresh={() => refreshService(service)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-2 py-1 bg-[#1a1b23] border-t border-zinc-800/50 flex items-center justify-end">
        <span className="text-[8px] text-zinc-600">
          auto-refresh: 5s
        </span>
      </div>
    </div>
  )
}
