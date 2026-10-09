import { access, mkdir } from 'node:fs/promises'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { applicationFixtures } from './Tests/browser/applicationFixtures.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const browserPath = path.join(root, '.playwright-browsers')
process.env.PLAYWRIGHT_BROWSERS_PATH ??= browserPath
const { chromium } = await import('playwright')

const screenshots = [
  { name: 'desktop.png', width: 1440, height: 914, mobile: false },
  { name: 'mobile.png', width: 500, height: 758, mobile: true },
]

function fixtureForScreenshots() {
  const fixture = applicationFixtures()
  const names = ['🇭🇰 Hong Kong 01 · IEPL', '🇸🇬 Singapore 02', '🇯🇵 Tokyo 03', 'Self-hosted · Japan']
  const profiles = [
    ['hk-iepl', 'vless', 'hk1.example.invalid', 443, 'tcp', 'reality', 46, 86.2, 'Hong Kong', 31_000_000, 475_000_000, 1_000_000_000, 15_000_000_000, true, 'airport'],
    ['sg-vmess', 'vmess', 'sg2.example.invalid', 8443, 'ws', 'tls', 82, 32.5, 'Singapore', 1_000_000, 9_000_000, 50_000_000, 256_000_000, false, 'airport'],
    ['jp-hysteria', 'hysteria2', 'jp3.example.invalid', 8443, 'udp', 'tls', -1, null, 'Tokyo', 0, 0, 0, 0, false, 'airport'],
    ['jp-local', 'shadowsocks', 'osaka.example.invalid', 8388, 'tcp', 'none', 141, null, 'Osaka', 0, 0, 30_000_000, 150_000_000, false, 'local'],
  ]
  fixture['/api/profiles'] = profiles.map(([indexId, protocol, address, port, network, streamSecurity, delay, speed, ipInfo, todayUp, todayDown, totalUp, totalDown, isCurrent, subscriptionId], index) => ({
    indexId,
    remarks: names[index],
    configType: index === 1 ? 'VMess' : index === 3 ? 'Shadowsocks' : index === 2 ? 'Hysteria2' : 'VLESS',
    protocol,
    address,
    port,
    network,
    streamSecurity,
    ipInfo,
    subscriptionName: subscriptionId === 'local' ? 'Self-hosted' : 'Airport A 2026',
    delay,
    speed,
    todayUp,
    todayDown,
    totalUp,
    totalDown,
    isCurrent,
  }))
  fixture['/api/profile-groups'] = [
    { id: '', name: 'All', profileCount: 4 },
    { id: 'local', name: 'Self-hosted', profileCount: 1 },
    { id: 'airport', name: 'Airport A 2026', profileCount: 3 },
  ]
  fixture['/api/subscriptions'] = [
    { id: 'local', remarks: 'Self-hosted', enabled: true, url: '', autoUpdateInterval: 0, updateTime: 0 },
    { id: 'airport', remarks: 'Airport A 2026', enabled: true, url: 'https://subscription.example.invalid/airport-a', autoUpdateInterval: 0, updateTime: 1791212280 },
    { id: 'backup', remarks: 'Backup subscription', enabled: false, url: 'https://subscription.example.invalid/backup', autoUpdateInterval: 60, updateTime: 1791125880 },
  ]
  fixture['/api/status'] = {
    ...fixture['/api/status'],
    coreRunning: true,
    coreType: 'Xray',
    runtimeState: 'running',
    currentProfileName: names[0],
    statisticsEnabled: true,
    listeners: [{ name: 'local', listening: true, listenAddress: '127.0.0.1', port: 10808, protocols: ['http', 'socks', 'udp'] }],
    traffic: { proxyUp: 1_200_000, proxyDown: 46_000_000, directUp: 200_000, directDown: 1_000_000 },
  }
  fixture['/api/settings'] = { ...fixture['/api/settings'], showIpInfoColumn: true }
  fixture['/api/auth/sse-ticket'] = { ticket: 'readme-screenshot-fixture' }
  return fixture
}

const fixture = fixtureForScreenshots()
let server
let browser

async function findAvailablePort() {
  const probe = net.createServer()
  return new Promise((resolve, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      if (!address || typeof address === 'string') return reject(new Error('Could not reserve a local port'))
      probe.close(error => error ? reject(error) : resolve(address.port))
    })
  })
}

try {
  await access(chromium.executablePath()).catch(() => {
    throw new Error(`Playwright Chromium is not installed. Run: PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium`)
  })

  const port = await findAvailablePort()
  server = await createServer({
    configFile: path.join(root, 'vite.config.js'),
    server: { host: '127.0.0.1', port, strictPort: true },
  })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Vite did not expose a local TCP address')
  const base = `http://127.0.0.1:${address.port}`
  browser = await chromium.launch()

  const output = path.join(root, 'docs/screenshots')
  await mkdir(output, { recursive: true })
  for (const screenshot of screenshots) {
    const context = await browser.newContext({
      viewport: { width: screenshot.width, height: screenshot.height },
      isMobile: screenshot.mobile,
      hasTouch: screenshot.mobile,
      colorScheme: 'light',
      locale: 'en-US',
      reducedMotion: 'reduce',
    })
    await context.addInitScript(() => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'readme-screenshot-fixture')
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      localStorage.setItem('v2rayn-web-theme', 'light')
      window.EventSource = class {
        addEventListener() {}
        removeEventListener() {}
        close() {}
      }
    })
    const page = await context.newPage()
    await page.route('**/api/**', route => {
      const pathname = new URL(route.request().url()).pathname
      return route.fulfill({ json: { success: true, data: fixture[pathname] ?? [] } })
    })
    await page.goto(base)
    await page.locator('[data-profile-id="hk-iepl"]').waitFor({ state: 'visible' })
    await page.locator('.page-feedback[aria-busy="false"]').waitFor()
    await page.evaluate(() => document.fonts.ready.then(() => true))
    await page.screenshot({ path: path.join(output, screenshot.name), animations: 'disabled', caret: 'hide' })
    console.log(`Captured ${path.join('docs/screenshots', screenshot.name)} (${screenshot.width}×${screenshot.height})`)
    await context.close()
  }
} finally {
  await browser?.close()
  await server?.close()
}
