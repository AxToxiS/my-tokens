import { app, BrowserWindow, ipcMain, session } from 'electron'
import path from 'path'

// Fix cookie persistence — set explicit userData before app is ready
app.setPath('userData', path.join(app.getPath('appData'), 'my-tokens-scraper'))

// ============ TEST MODE ============
const USE_MOCK = false // Set to true for testing with fake data
// ===================================

let mainWindow: BrowserWindow | null = null
const scraperWindows: Map<string, BrowserWindow> = new Map()
const loadingInProgress: Set<string> = new Set()

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
    width: 260,
    height: 360,
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
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:scraper-${service}`,
    },
  })
  win.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  )
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

// Poll DOM until expected text appears (for SPAs that render after did-finish-load)
async function waitForContent(win: BrowserWindow, needle: string, timeoutMs = 12000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const found: boolean = await win.webContents.executeJavaScript(
        `document.body && document.body.innerText.includes(${JSON.stringify(needle)})`
      )
      if (found) return true
    } catch { /* window may be navigating */ }
    await new Promise((r) => setTimeout(r, 600))
  }
  return false
}

const SERVICE_CONTENT_MARKER: Record<string, string> = {
  openai: 'restante',
  claude: 'usado',
  github: 'Premium requests',
  windsurf: 'lines written',
}

async function scrapeService(service: string): Promise<ServiceData | null> {
  const url = SERVICE_URLS[service]
  if (!url) return null

  // Prevent concurrent scrapes of the same service
  if (loadingInProgress.has(service)) {
    log(`${service}: scrape already in progress, skipping`)
    return null
  }
  loadingInProgress.add(service)

  try {
    let win = scraperWindows.get(service)
    if (!win || win.isDestroyed()) {
      win = createScraperWindow(service, url)
      scraperWindows.set(service, win)
    }

    // For SPAs: load home first then navigate internally
    const marker = SERVICE_CONTENT_MARKER[service]
    if (service === 'claude') {
      win.loadURL('https://claude.ai/settings/usage')
      await waitForLoad(win)
      // Wait for SPA to hydrate, then click the Usage link if present
      await new Promise((r) => setTimeout(r, 3000))
      await win.webContents.executeJavaScript(`
        (function() {
          var links = Array.from(document.querySelectorAll('a[href*="usage"], a[href*="Usage"]'));
          if (links.length > 0) { links[0].click(); }
        })()
      `).catch(() => {})
      await new Promise((r) => setTimeout(r, 3000))
    } else if (service === 'windsurf') {
      win.loadURL('https://windsurf.com/profile')
      await waitForLoad(win)
      await new Promise((r) => setTimeout(r, 5000))
    } else {
      win.loadURL(url)
      await waitForLoad(win)
    }
    if (marker) {
      const found = await waitForContent(win, marker)
      log(`${service}: content marker "${marker}" found=${found}, url=${win.webContents.getURL()}`)
    } else {
      await new Promise((r) => setTimeout(r, 2000))
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
  } finally {
    loadingInProgress.delete(service)
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

function getClaudeScript(): string {
  // Find ALL "X% usado" or "X% used" occurrences.
  // Claude page has exactly 2: first = session (5h), second = weekly
  const code = [
    '(function() {',
    '  try {',
    '    var t = document.body ? document.body.innerText : "";',
    '    var result = { pageTitle: document.title, bodyPreview: t.substring(0, 5000) };',
    '',
    '    var re = /(\\d+\\.?\\d*)\\s*%\\s*(?:usado|used)/gi;',
    '    var matches = [];',
    '    var m;',
    '    while ((m = re.exec(t)) !== null) { matches.push(parseFloat(m[1])); }',
    '',
    '    if (matches.length >= 1) { result.fiveHourUsage = 100 - matches[0]; result.fiveHourLimit = 100; }',
    '    if (matches.length >= 2) { result.weeklyUsage = 100 - matches[1]; result.weeklyLimit = 100; }',
    '',
    '    result.debugMatches = matches;',
    '    return result;',
    '  } catch(e) { return { error: e.message, pageTitle: document.title }; }',
    '})()',
  ]
  return code.join('\n')
}

function getGithubScript(): string {
  const code = [
    '(function() {',
    '  try {',
    '    var t = document.body ? document.body.innerText : "";',
    '    var result = { pageTitle: document.title, bodyPreview: t.substring(0, 3000) };',
    '',
    '    var i = t.toLowerCase().indexOf("premium requests");',
    '    if (i >= 0) {',
    '      var chunk = t.substring(i, i + 200);',
    '      var m = chunk.match(/(\\d+\\.?\\d*)\\s*%/);',
    '      if (m) {',
    '        result.premiumRequests = 100 - parseFloat(m[1]);',
    '        result.premiumRequestsLimit = 100;',
    '      }',
    '    }',
    '',
    '    return result;',
    '  } catch(e) { return { error: e.message, pageTitle: document.title }; }',
    '})()',
  ]
  return code.join('\n')
}

function getWindsurfScript(): string {
  const code = [
    '(function() {',
    '  try {',
    '    var t = document.body ? document.body.innerText : "";',
    '    var result = { pageTitle: document.title, bodyPreview: t.substring(0, 3000) };',
    '',
    '    // "62,930 lines written by Cascade" — number is right before the phrase',
    '    var li = t.indexOf("lines written by");',
    '    if (li >= 0) {',
    '      var before = t.substring(Math.max(0, li - 40), li).trim();',
    '      var m = before.match(/([\\d,\\.]+)\\s*$/);',
    '      if (m) result.linesWritten = parseInt(m[1].replace(/[,\\.]/g, ""));',
    '    }',
    '',
    '    // "Total credits used" — appears on non-enterprise accounts',
    '    var ci = t.indexOf("Total credits used");',
    '    if (ci >= 0) {',
    '      var after = t.substring(ci + 18, ci + 80);',
    '      var m2 = after.match(/([\\d,]+)/);',
    '      if (m2) result.creditsUsed = parseInt(m2[1].replace(/,/g, ""));',
    '    }',
    '',
    '    // Generic credits patterns for manage-plan page',
    '    if (result.creditsUsed == null) {',
    '      var mp = t.match(/([\\d,\\.]+)\\s*\\/\\s*([\\d,\\.]+)\\s*credits?/i);',
    '      if (mp) {',
    '        result.creditsUsed  = parseFloat(mp[1].replace(/,/g, ""));',
    '        result.creditsLimit = parseFloat(mp[2].replace(/,/g, ""));',
    '      }',
    '    }',
    '',
    '    return result;',
    '  } catch(e) { return { error: e.message, pageTitle: document.title }; }',
    '})()',
  ]
  return code.join('\n')
}

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
      // Real DOM text: "Sesión actual\n\nSe inicia...\n\n0% usado\n\nLímites semanales\n...\nTodos los modelos\n\n...\n\n15% usado"
      return getClaudeScript()

    case 'github':
      // github.com/settings/copilot/features
      // Real DOM text: "Premium requests\n1.7%"
      return getGithubScript()

    case 'windsurf':
      // windsurf.com/profile — "Total credits used\n\n1099"
      return getWindsurfScript()

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

const LOGIN_URLS: Record<string, string> = {
  openai: 'https://chatgpt.com',
  claude: 'https://claude.ai',
  github: 'https://github.com/login',
  windsurf: 'https://windsurf.com/account/login',
}

ipcMain.handle('open-service-login', async (_event, service: string) => {
  const loginUrl = LOGIN_URLS[service] || SERVICE_URLS[service]
  if (!loginUrl) return

  log(`Opening login window for ${service}: ${loginUrl}`)

  // Always create a fresh login window — same partition as the scraper for this service
  const loginWin = new BrowserWindow({
    width: 1000,
    height: 750,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      partition: `persist:scraper-${service}`,
    },
  })
  loginWin.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  )
  loginWin.loadURL(loginUrl)
  loginWin.show()

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

ipcMain.handle('logout-service', async (_event, service: string) => {
  log(`Logging out service: ${service}`)
  const domains: Record<string, string> = {
    openai: 'chatgpt.com',
    claude: 'claude.ai',
    github: 'github.com',
    windsurf: 'windsurf.com',
  }
  const domain = domains[service]
  if (domain) {
    const ses = session.fromPartition(`persist:scraper-${service}`)
    await ses.clearStorageData({
      origin: `https://${domain}`,
      storages: ['cookies', 'localstorage', 'sessionstorage', 'indexdb', 'websql', 'cachestorage'],
    }).catch(() => {})
    // Also remove cookies by domain directly
    const cookies = await ses.cookies.get({ domain: `.${domain}` }).catch(() => [] as Electron.Cookie[])
    for (const cookie of cookies) {
      const url = `https://${cookie.domain?.replace(/^\./, '')}${cookie.path || '/'}`
      await ses.cookies.remove(url, cookie.name).catch(() => {})
    }
  }
  // Destroy scraper window so next scrape starts fresh
  const win = scraperWindows.get(service)
  if (win && !win.isDestroyed()) win.close()
  scraperWindows.delete(service)
  log(`Logout complete for ${service}`)
})

ipcMain.on('minimize-window', () => {
  mainWindow?.minimize()
})

ipcMain.on('close-window', () => {
  mainWindow?.close()
})

ipcMain.on('resize-window', (_event, height: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [w] = mainWindow.getSize()
    mainWindow.setSize(w, Math.ceil(height))
  }
})

ipcMain.on('set-opacity', (_event, opacity: number) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(Math.max(0.1, Math.min(1.0, opacity)))
  }
})

function startAutoRefresh() {
  const INTERVAL = 30_000
  // Stagger each service so they don't all reload simultaneously
  Object.keys(SERVICE_URLS).forEach((service, idx) => {
    setTimeout(async () => {
      // First tick immediately after stagger
      const run = async () => {
        if (!mainWindow || mainWindow.isDestroyed()) return
        log(`Auto-refresh: ${service}`)
        const result = await scrapeService(service)
        if (result && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('service-data-update', result)
        }
      }
      await run()
      setInterval(run, INTERVAL)
    }, idx * 2000) // stagger 2s apart so not all reload at once
  })
}

app.whenReady().then(async () => {
  createWindow()
  await new Promise((r) => setTimeout(r, 1000))
  // Initial parallel scrape
  await Promise.all(Object.keys(SERVICE_URLS).map(async (service) => {
    const result = await scrapeService(service)
    if (result && mainWindow && !mainWindow.isDestroyed()) {
      log(`Push initial data for ${service}:`, result)
      mainWindow.webContents.send('service-data-update', result)
    }
  }))
  startAutoRefresh()
})

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
