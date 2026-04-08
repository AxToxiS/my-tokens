import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import TitleBar from './components/TitleBar'
import ServiceCard from './components/ServiceCard'

const SERVICES = ['openai', 'claude', 'github', 'windsurf']

export default function App() {
  const [serviceData, setServiceData] = useState<Record<string, ServiceData | null>>({})
  const [loadingServices, setLoadingServices] = useState<Set<string>>(new Set())
  const [lastRefresh, setLastRefresh] = useState<string>('')
  const didInit = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

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
    await Promise.all(SERVICES.map((s) => refreshService(s)))
    setLastRefresh(new Date().toLocaleTimeString())
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

  // Listen for push updates from main process
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    window.electronAPI.onServiceDataUpdate((data: ServiceData) => {
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

  return (
    <div ref={rootRef} className="w-full bg-[#1a1b23] rounded-lg overflow-hidden flex flex-col border border-zinc-800/50">
      <TitleBar />

      {/* Main content */}
      <div className="flex-1 p-1 space-y-1">
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
      <div className="px-2 py-1 bg-[#1a1b23] border-t border-zinc-800/50 flex items-center justify-between">
        <span className="text-[8px] text-zinc-600">
          {lastRefresh ? `Último: ${lastRefresh}` : '...'}
        </span>
        <span className="text-[8px] text-zinc-600">
          auto: 5s
        </span>
      </div>
    </div>
  )
}
