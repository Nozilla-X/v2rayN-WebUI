// Real Backend/browser integration. No API or EventSource mocks. Run against an
// isolated native artifact using WEBAPI_EXECUTABLE; never point this at user data.
import assert from 'node:assert/strict'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
const { chromium, firefox } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const executable = process.env.WEBAPI_EXECUTABLE
const root = process.env.BROWSER_TEST_DIR
const lan = process.env.LAN_ADDRESS
assert.ok(executable && root && lan, 'WEBAPI_EXECUTABLE, BROWSER_TEST_DIR and LAN_ADDRESS are required')
const dist = path.resolve('dist')
const key = (await readFile(path.join(root, 'management-key'), 'utf8')).trim()
const httpOrigin = 'http://127.0.0.1:5178'
const httpsOrigin = 'https://127.0.0.1:5443'
const publicOrigin = process.env.PUBLIC_HTTPS_ORIGIN // Optional real public HTTPS origin, see docs.
let apiBase = 'http://127.0.0.1:5180'
const assetFiles = new Map()
async function asset(requestPath) {
  if (requestPath === '/webui-config.js') return Buffer.from(`window.__V2RAYN_WEBUI_CONFIG__ = ${JSON.stringify({ apiBaseUrl: apiBase })}`)
  if (!assetFiles.has(requestPath)) {
    const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1)
    const file = path.resolve(dist, relative)
    if (!file.startsWith(dist + path.sep)) throw new Error('invalid asset')
    assetFiles.set(requestPath, await readFile(file))
  }
  return assetFiles.get(requestPath)
}
function contentType(url) {
  return url.endsWith('.js') ? 'application/javascript' : url.endsWith('.css') ? 'text/css'
    : url.endsWith('.ico') ? 'image/x-icon' : url.endsWith('.png') ? 'image/png' : 'text/html'
}
async function serve(req, res) {
  const url = new URL(req.url, httpOrigin).pathname
  if (url.startsWith('/api/') || url.startsWith('/prefix/api/')) {
    // Same-origin HTTPS reverse-proxy regression, preserving browser metadata.
    const upstream = http.request('http://127.0.0.1:5180' + req.url.replace(/^\/prefix(?=\/api\/)/, ''), {
      method: req.method, headers: { ...req.headers, 'x-forwarded-proto': req.socket.encrypted ? 'https' : 'http' },
    }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res) })
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
    res.on('close', () => upstream.destroy())
    req.pipe(upstream)
    return
  }
  try { res.writeHead(200, { 'Content-Type': contentType(url), 'Cache-Control': 'no-store' }); res.end(await asset(url)) }
  catch { res.writeHead(404); res.end() }
}
const httpServer = http.createServer(serve)
const httpsServer = https.createServer({ key: await readFile(path.join(root, 'tls.key')), cert: await readFile(path.join(root, 'tls.crt')) }, serve)
await new Promise(resolve => httpServer.listen(5178, '127.0.0.1', resolve))
await new Promise(resolve => httpsServer.listen(5443, '127.0.0.1', resolve))
const results = []
let sequence = 0

async function startApi(hosted, proxySameOrigin = false) {
  const data = path.join(root, `data-${++sequence}`)
  await mkdir(data)
  const log = await import('node:fs').then(fs => fs.createWriteStream(path.join(root, `api-${sequence}.log`)))
  const child = spawn(executable, ['--foreground', '--no-open'], {
    env: { ...process.env, ASPNETCORE_URLS: `http://127.0.0.1:5180;http://${lan}:5180`,
      V2RAYN_WEB_API_KEY: key, V2RAYN_WEB_ALLOWED_ORIGINS: proxySameOrigin ? '' : [httpOrigin, httpsOrigin, publicOrigin].filter(Boolean).join(','),
      V2RAYN_WEB_UI_PATH: hosted ? dist : '', V2RAYN_DATA_HOME: data,
      DOTNET_BUNDLE_EXTRACT_BASE_DIR: path.join(data, '.net-bundle'),
      V2RAYN_WEB_AUTOSTART: 'false', V2RAYN_WEB_PROXY_PORT: String(11500 + sequence) },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout.pipe(log); child.stderr.pipe(log)
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch('http://127.0.0.1:5180/api/health')).ok) return { child, log } } catch {}
    if (child.exitCode !== null) throw new Error('isolated API failed startup; inspect local log')
    await delay(100)
  }
  throw new Error('isolated API startup timed out')
}

async function stopApi(instance) {
  if (instance.child.exitCode === null) {
    const stopped = new Promise(resolve => instance.child.once('exit', resolve))
    instance.child.kill('SIGTERM')
    // Kestrel's configured shutdown budget is 25 s; allow that plus runtime cleanup.
    await Promise.race([stopped, delay(60000).then(() => { throw new Error('isolated API did not stop gracefully') })])
  }
  instance.log.end()
}

async function emitSettingsEvent() {
  const login = await fetch('http://127.0.0.1:5180/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
  const token = (await login.json()).data.token
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  const settings = (await (await fetch('http://127.0.0.1:5180/api/settings', { headers })).json()).data
  const response = await fetch('http://127.0.0.1:5180/api/settings/inbound', { method: 'PUT', headers, body: JSON.stringify(settings.inbound) })
  assert.ok(response.ok, 'real settings event emission')
}

function safeMessage(message) {
  return message.replace(/([?&](?:sse_ticket|access_token)=)[^&\s'"\)]+/g, '$1<redacted>')
}

async function runCase(browser, browserName, scenario, base, uiOrigin, hosted = false, publicPage = false) {
  if (process.env.BROWSER_CASES && !process.env.BROWSER_CASES.split(',').includes(scenario)) return
  apiBase = base
  const instance = await startApi(hosted, scenario === 'https-same-origin-proxy')
  const context = await browser.newContext({ ignoreHTTPSErrors: !publicPage,
    ...(publicPage && process.env.PUBLIC_BROWSER_PROXY ? { proxy: { server: process.env.PUBLIC_BROWSER_PROXY, bypass: `127.0.0.1,localhost,${lan}` } } : {}) })
  const page = await context.newPage()
  const result = { browser: browserName, version: browser.version(), scenario, base, uiOrigin, apiRequestsBeforeAction: 0, rest: false, sse: false, permissionRetry: false, console: [], networkFailures: [] }
  let actionStarted = false
  page.on('request', request => { if (new URL(request.url()).pathname.includes('/api/') && !actionStarted) result.apiRequestsBeforeAction++ })
  page.on('requestfailed', request => result.networkFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }))
  page.on('console', message => { if (message.type() === 'error') result.console.push(safeMessage(message.text())) })
  await context.addInitScript(() => {
    localStorage.setItem('v2rayn-web-locale', 'en-US')
    window.__sseOpen = 0
    const NativeEventSource = window.EventSource
    window.EventSource = class extends NativeEventSource {
      constructor(...args) { super(...args); this.addEventListener('open', () => { window.__sseOpen++ }) }
    }
  })
  try {
    if (browserName === 'Chrome') {
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      cdp.on('Network.responseReceivedExtraInfo', event => {
        if (event.resourceIPAddressSpace) result.observedAddressSpaces = [...new Set([...(result.observedAddressSpaces || []), event.resourceIPAddressSpace])]
      })
      cdp.on('Network.responseReceived', event => {
        if (event.type === 'Document') result.navigationRemoteAddress = event.response.remoteIPAddress
      })
    }
    await page.goto(uiOrigin)
    if (publicPage) {
      // Navigate a real public HTTPS document first, retaining its secure context
      // and browser address-space classification. Replace only the static UI
      // document/assets with the local artifact; never intercept /api requests.
      await page.route(`${uiOrigin}/**`, async route => {
        const pathname = new URL(route.request().url()).pathname
        try { await route.fulfill({ contentType: contentType(pathname), body: await asset(pathname) }) }
        catch { await route.fulfill({ status: 404 }) }
      })
      // Do not document.write/setContent: that creates a synthetic document with
      // Unknown address space. Keep the actual public navigation's document.
      await page.evaluate(async html => {
        const artifact = new DOMParser().parseFromString(html, 'text/html')
        document.title = artifact.title
        document.body.innerHTML = '<div id="app"></div>'
        for (const icon of document.querySelectorAll('link[rel~="icon"]')) icon.remove()
        for (const link of artifact.querySelectorAll('link')) document.head.append(link.cloneNode(true))
        // Vite moves its deferred module into <head>, while the classic runtime
        // config in <body> runs first during normal HTML parsing. Preserve that.
        const scripts = [...artifact.querySelectorAll('script')].sort((a, b) => Number(a.type === 'module') - Number(b.type === 'module'))
        for (const original of scripts) {
          const script = document.createElement('script')
          for (const attribute of original.attributes) script.setAttribute(attribute.name, attribute.value)
          await new Promise((resolve, reject) => {
            script.onload = resolve; script.onerror = reject; document.body.append(script)
          })
        }
      }, await readFile(path.join(dist, 'index.html'), 'utf8'))
      result.publicDocumentArtifactInjection = true
    }
    await page.locator('#api-endpoint').waitFor()
    await page.waitForTimeout(250)
    if (!hosted) assert.equal(result.apiRequestsBeforeAction, 0, 'standalone mode makes no automatic API request')
    actionStarted = true
    if (!hosted) {
      async function test() {
        const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/api/health') && response.ok(), { timeout: 12000 })
        await page.getByRole('button', { name: 'Test connection', exact: true }).click()
        return response
      }
      try { await test() }
      catch {
        result.permissionRetry = true
        try { await context.grantPermissions(['local-network-access'], { origin: uiOrigin }) }
        catch (error) { result.permissionGrantError = safeMessage(error.message) }
        try { await test() }
        catch { result.diagnostics = await page.locator('[role="alert"]').allTextContents(); return }
      }
    }
    await page.locator('#management-key').fill(key)
    await page.locator('#management-key').press('Enter')
    await page.locator('.workspace').waitFor({ timeout: 12000 })
    result.rest = true
    await emitSettingsEvent()
    await page.waitForFunction(() => window.__sseOpen > 0, { timeout: 10000 })
    result.sse = true
    const stored = await page.evaluate(() => Object.keys(localStorage))
    assert.equal(stored.includes('v2rayn-web-token'), false)
    assert.ok(stored.some(key => key.startsWith('v2rayn-api-session:')))
    const favicon = await page.locator('link[rel~="icon"]').getAttribute('href')
    assert.equal(new URL(favicon, uiOrigin).origin, new URL(uiOrigin).origin)
    const download = await page.evaluate(async base => {
      const identity = base || location.origin
      const token = localStorage.getItem('v2rayn-api-session:' + encodeURIComponent(identity))
      const response = await fetch(identity + '/api/backup/download', { headers: { Authorization: `Bearer ${token}` }, credentials: 'omit', redirect: 'error' })
      return { status: response.status, disposition: response.headers.get('Content-Disposition'), bytes: (await response.blob()).size }
    }, hosted ? '' : base)
    assert.equal(download.status, 200)
    assert.ok(download.disposition && download.bytes > 0)
    result.download = true
    await page.screenshot({ path: path.join(root, `${browserName}-${scenario}.png`) })
  } catch (error) { result.error = safeMessage(error.message) }
  finally {
    results.push(result)
    await writeFile(path.join(root, 'results.json'), JSON.stringify(results, null, 2))
    await context.close()
    await stopApi(instance)
  }
}

try {
  for (const [name, type] of [['Chrome', chromium], ['Firefox', firefox]]) {
    const browser = await type.launch(name === 'Chrome' ? {
      ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}),
      ...(!process.env.PUBLIC_BROWSER_PROXY ? { args: ['--no-proxy-server'] } : {}),
    } : {})
    try {
      await runCase(browser, name, 'same-origin', '', 'http://127.0.0.1:5180', true)
      await runCase(browser, name, 'https-same-origin-proxy', '', httpsOrigin, true)
      await runCase(browser, name, 'http-localhost', 'http://127.0.0.1:5180', httpOrigin)
      await runCase(browser, name, 'path-prefix', httpsOrigin + '/prefix', httpOrigin)
      await runCase(browser, name, 'https-localhost', 'http://127.0.0.1:5180', httpsOrigin)
      await runCase(browser, name, 'https-lan', `http://${lan}:5180`, httpsOrigin)
      if (publicOrigin) {
        await runCase(browser, name, 'public-https-localhost', 'http://127.0.0.1:5180', publicOrigin, false, true)
        await runCase(browser, name, 'public-https-lan', `http://${lan}:5180`, publicOrigin, false, true)
      }
    } finally { await browser.close() }
  }
} finally {
  await Promise.all([new Promise(resolve => httpServer.close(resolve)), new Promise(resolve => httpsServer.close(resolve))])
}
console.log(JSON.stringify(results.map(({ browser, version, scenario, rest, sse, permissionRetry, error }) => ({ browser, version, scenario, rest, sse, permissionRetry, error })), null, 2))
assert.ok(results.filter(result => ['same-origin', 'https-same-origin-proxy', 'http-localhost'].includes(result.scenario)).every(result => result.rest && result.sse && !result.error), 'same-origin, reverse proxy and independent HTTP must pass in both browsers')
assert.ok(results.every(result => !result.error), 'unexpected browser/harness errors; inspect results.json (documented browser-policy blocks are recorded separately)')
