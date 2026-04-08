import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'

// ============ TEST MODE ============
const USE_MOCK = false // Set to true for testing with fake data
// ===================================

let mainWindow: BrowserWindow | null = null
const scraperWindows: Map<string, BrowserWindow> = new Map()

const SERVICE_URLS: Record<string, string> = {
  openai: 'https://chatgpt.com/codex/settings/usage',
  claude: 'https://claude.ai/settings/usage',
  github: 'https://github.com/settings/copilot/features',
  windsurf: 'https://windsurf.com/profile',
}

function log(msg: string, data?: any) {
  const ts = new Date().toISOString().substring(11, 19)
  if (data !== undefined) {
    console.log(`[${ts}] ${msg}`, JSON.stringify(data, null, 2))
  } else {
    console.log(`[${ts}] ${msg}`)
  }
}

function getMockData(service: string): ServiceData {
  const mocks: Record<string, ServiceData> = {
    openai: {
      service: 'openai',
      fiveHourUsage: 62,
      fiveHourLimit: 100,
      weeklyUsage: 340,
      weeklyLimit: 500,
      lastUpdated: Date.now(),
    },
    claude: {
      service: 'claude',
      fiveHourUsage: 45,
      fiveHourLimit: 100,
      weeklyUsage: 210,
      weeklyLimit: 500,
      lastUpdated: Date.now(),
    },
    github: {
      service: 'github',
      premiumRequests: 187,
      premiumRequestsLimit: 300,
      lastUpdated: Date.now(),
    },
    windsurf: {
      service: 'windsurf',
      tokensUsed: 1250000,
      tokensLimit: 3000000,
      lastUpdated: Date.now(),
    },
  }
  return mocks[service] || { service, lastUpdated: Date.now(), error: 'Unknown service' }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minimizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    log('Main window loaded')
  })
}

function createScraperWindow(service: string, url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:scraper',
    },
  })
  win.loadURL(url)
  return win
}

async function waitForLoad(win: BrowserWindow, timeoutMs = 15000): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = () => resolve()
    win.webContents.once('did-finish-load', done)
    setTimeout(done, timeoutMs)
  })
}

async function scrapeService(service: string): Promise<ServiceData | null> {
  const url = SERVICE_URLS[service]
  if (!url) return null

  try {
    let win = scraperWindows.get(service)
    if (!win || win.isDestroyed()) {
      win = createScraperWindow(service, url)
      scraperWindows.set(service, win)
    } else {
      win.loadURL(url)
    }

    await waitForLoad(win)
    await new Promise((r) => setTimeout(r, 3000))

    // Check if we got redirected away (e.g. Claude → chat, GitHub → login)
    const finalUrl = win.webContents.getURL()
    log(`${service}: target=${url}, landed=${finalUrl}`)

    // If redirected, try navigating directly once more
    if (!finalUrl.includes(new URL(url).pathname)) {
      log(`${service}: redirected, retrying navigation to ${url}`)
      win.loadURL(url)
      await waitForLoad(win)
      await new Promise((r) => setTimeout(r, 3000))
      log(`${service}: retry landed=${win.webContents.getURL()}`)
    }

    const data = await win.webContents.executeJavaScript(
      getScraperScript(service)
    )

    return {
      service,
      ...data,
      lastUpdated: Date.now(),
    }
  } catch (error: any) {
    console.error(`Error scraping ${service}:`, error.message)
    return {
      service,
      lastUpdated: Date.now(),
      error: error.message || 'Unknown error',
    }
  }
}

// Shared scraper helper: extracts percentages like "83 %" or "83%" from text
// and looks for patterns like "X % restante" near known labels
const SHARED_SCRAPER_UTILS = `
  function findPercent(text, label) {
    // Search for "label ... N % restante" or "label ... N% remaining"
    var patterns = [
      new RegExp(label + '[\\\\s\\\\S]{0,100}?(\\\\d+)\\\\s*[%％]\\\\s*restante', 'i'),
      new RegExp(label + '[\\\\s\\\\S]{0,100}?(\\\\d+)\\\\s*[%％]\\\\s*remaining', 'i'),
      new RegExp(label + '[\\\\s\\\\S]{0,100}?(\\\\d+\\\\.?\\\\d*)\\\\s*[%％]', 'i'),
    ];
    for (var i = 0; i < patterns.length; i++) {
      var m = text.match(patterns[i]);
      if (m) return parseFloat(m[1]);
    }
    return null;
  }
  function safeText() { return document.body ? document.body.innerText : ''; }
`;

function getScraperScript(service: string): string {
  switch (service) {
    case 'openai':
      // chatgpt.com/codex/settings/usage - similar structure to Claude
      return `
        (function() {
          ${SHARED_SCRAPER_UTILS}
          try {
            var t = safeText();
            var result = { pageTitle: document.title, bodyPreview: t.substring(0, 2000) };

            // Try "5 hour" / "5 horas" pattern
            var h5 = findPercent(t, '5.hour') || findPercent(t, '5.hora');
            // Try "weekly" / "semanal" pattern
            var wk = findPercent(t, 'weekly') || findPercent(t, 'semanal');

            if (h5 !== null) {
              // "X % restante" → store remaining directly (100=full, 0=depleted)
              result.fiveHourUsage = h5;
              result.fiveHourLimit = 100;
            }
            if (wk !== null) {
              result.weeklyUsage = wk;
              result.weeklyLimit = 100;
            }

            // Fallback: grab all percentages
            var pcts = t.match(/\\d+\\.?\\d*\\s*[%％]/g) || [];
            result.rawPercentages = pcts.slice(0, 10);
            result.rawNumbers = (t.match(/\\d+\\.?\\d*\\s*\\/\\s*\\d+\\.?\\d*/g) || []).slice(0, 10);
            return result;
          } catch(e) { return { error: e.message, pageTitle: document.title }; }
        })()
      `

    case 'claude':
      // claude.ai/settings/usage
      // Real DOM: "Sesión actual" → "0% usado", "Todos los modelos" → "15% usado"
      return `
        (function() {
          ${SHARED_SCRAPER_UTILS}
          try {
            var t = safeText();
            var result = { pageTitle: document.title, bodyPreview: t.substring(0, 5000) };

            // "Sesión actual" section → "X% usado" (current session = 5-hour equivalent)
            var sessionUsed = null;
            var sessionMatch = t.match(/[Ss]esi[oó]n actual[\\s\\S]{0,200}?(\\d+\\.?\\d*)\\s*[%％]\\s*usado/i);
            if (sessionMatch) sessionUsed = parseFloat(sessionMatch[1]);
            // English fallback
            if (sessionUsed === null) {
              var sessionMatchEn = t.match(/[Cc]urrent session[\\s\\S]{0,200}?(\\d+\\.?\\d*)\\s*[%％]\\s*used/i);
              if (sessionMatchEn) sessionUsed = parseFloat(sessionMatchEn[1]);
            }

            // "Todos los modelos" or "All models" → "X% usado" (weekly)
            var weeklyUsed = null;
            var weeklyMatch = t.match(/[Tt]odos los modelos[\\s\\S]{0,200}?(\\d+\\.?\\d*)\\s*[%％]\\s*usado/i);
            if (weeklyMatch) weeklyUsed = parseFloat(weeklyMatch[1]);
            // English fallback
            if (weeklyUsed === null) {
              var weeklyMatchEn = t.match(/[Aa]ll models[\\s\\S]{0,200}?(\\d+\\.?\\d*)\\s*[%％]\\s*used/i);
              if (weeklyMatchEn) weeklyUsed = parseFloat(weeklyMatchEn[1]);
            }

            // Convert "% usado" → remaining = 100 - used
            if (sessionUsed !== null) {
              result.fiveHourUsage = 100 - sessionUsed;
              result.fiveHourLimit = 100;
            }
            if (weeklyUsed !== null) {
              result.weeklyUsage = 100 - weeklyUsed;
              result.weeklyLimit = 100;
            }

            var pcts = t.match(/\\d+\\.?\\d*\\s*[%％]/g) || [];
            result.rawPercentages = pcts.slice(0, 10);
            return result;
          } catch(e) { return { error: e.message, pageTitle: document.title }; }
        })()
      `

    case 'github':
      // github.com/settings/copilot/features
      // Real DOM: "Premium requests" → "1.0%" (percentage used)
      return `
        (function() {
          ${SHARED_SCRAPER_UTILS}
          try {
            var t = safeText();
            var result = { pageTitle: document.title, bodyPreview: t.substring(0, 3000) };

            // Look for "Premium requests" followed by a percentage like "1.0%"
            var premMatch = t.match(/[Pp]remium\\s*requests[\\s\\S]{0,200}?(\\d+\\.?\\d*)\\s*[%％]/i);
            if (premMatch) {
              var usedPct = parseFloat(premMatch[1]);
              // remaining = 100 - used
              result.premiumRequests = 100 - usedPct;
              result.premiumRequestsLimit = 100;
            }

            var pcts = t.match(/\\d+\\.?\\d*\\s*[%％]/g) || [];
            result.rawPercentages = pcts.slice(0, 10);
            return result;
          } catch(e) { return { error: e.message, pageTitle: document.title }; }
        })()
      `

    case 'windsurf':
      // windsurf.com/profile — Enterprise profile page
      // Real DOM: "Total credits used\n\n1099" and "Total Cascade conversations\n75"
      return `
        (function() {
          try {
            var t = document.body ? document.body.innerText : '';
            var result = { pageTitle: document.title, bodyPreview: t.substring(0, 3000) };

            // Extract "Total credits used" followed by a number
            var creditsIdx = t.indexOf('Total credits used');
            if (creditsIdx >= 0) {
              var after = t.substring(creditsIdx + 18, creditsIdx + 80);
              var lines = after.split('\\n');
              for (var i = 0; i < lines.length; i++) {
                var trimmed = lines[i].trim().replace(/[.,]/g, '');
                if (trimmed.length > 0 && !isNaN(Number(trimmed))) {
                  result.creditsUsed = parseInt(trimmed);
                  break;
                }
              }
            }

            // Extract "lines written by Cascade"
            var linesIdx = t.indexOf('lines written by');
            if (linesIdx >= 0) {
              var before = t.substring(Math.max(0, linesIdx - 30), linesIdx);
              var parts = before.split('\\n');
              var lastPart = parts[parts.length - 1].trim().replace(/[.,]/g, '');
              if (!isNaN(Number(lastPart))) {
                result.linesWritten = parseInt(lastPart);
              }
            }

            return result;
          } catch(e) { return { error: e.message, pageTitle: document.title }; }
        })()
      `

    default:
      return `(function() { return { error: 'Unknown service' } })()`
  }
}

// IPC Handlers
ipcMain.handle('scrape-service', async (_event, service: string) => {
  log(`scrape-service called for: ${service}, mock=${USE_MOCK}`)
  if (USE_MOCK) {
    const mock = getMockData(service)
    log(`Returning mock data for ${service}:`, mock)
    return mock
  }
  const result = await scrapeService(service)
  log(`Scrape result for ${service}:`, result)
  return result
})

ipcMain.handle('scrape-all-services', async () => {
  log('scrape-all-services called')
  const results: Record<string, ServiceData | null> = {}
  for (const service of Object.keys(SERVICE_URLS)) {
    if (USE_MOCK) {
      results[service] = getMockData(service)
    } else {
      results[service] = await scrapeService(service)
    }
  }
  log('All services result:', results)
  return results
})

ipcMain.handle('open-service-login', async (_event, service: string) => {
  const url = SERVICE_URLS[service]
  if (!url) return

  log(`Opening login window for ${service}: ${url}`)

  // Always create a fresh login window (separate from scraper windows)
  const loginWin = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:scraper',
    },
  })
  loginWin.loadURL(url)

  // When the user closes the login window, remove old scraper and notify renderer
  loginWin.once('closed', () => {
    log(`Login window closed for ${service}, clearing scraper and notifying renderer`)
    // Remove old scraper so a fresh one is created with the new session
    const oldWin = scraperWindows.get(service)
    if (oldWin && !oldWin.isDestroyed()) {
      oldWin.close()
    }
    scraperWindows.delete(service)
    // Notify renderer to re-scrape
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('service-login-closed', service)
    }
  })
})

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize()
})

ipcMain.on('close-window', () => {
  mainWindow?.close()
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  scraperWindows.forEach((win) => {
    if (!win.isDestroyed()) win.close()
  })
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

interface ServiceData {
  service: string
  fiveHourUsage?: number | null
  fiveHourLimit?: number | null
  weeklyUsage?: number | null
  weeklyLimit?: number | null
  premiumRequests?: number | null
  premiumRequestsLimit?: number | null
  tokensUsed?: number | null
  tokensLimit?: number | null
  creditsUsed?: number | null
  creditsLimit?: number | null
  lastUpdated: number
  error?: string
  [key: string]: any
}
