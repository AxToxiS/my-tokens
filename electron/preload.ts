import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  scrapeService: (service: string) => ipcRenderer.invoke('scrape-service', service),
  scrapeAllServices: () => ipcRenderer.invoke('scrape-all-services'),
  openServiceLogin: (service: string) => ipcRenderer.invoke('open-service-login', service),
  onServiceLoginClosed: (callback: (service: string) => void) => {
    ipcRenderer.on('service-login-closed', (_event, service) => callback(service))
  },
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
})
