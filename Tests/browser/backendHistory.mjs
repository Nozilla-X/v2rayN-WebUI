// Synthetic Backend addresses only (loopback + RFC 5737). No real addresses or keys.
import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const labels = JSON.parse(await readFile(new URL('../../Src/Locales/en-US.json', import.meta.url), 'utf8'))
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
const HISTORY_KEY = 'v2rayn-api-endpoint-history'
const fixtureAddress = 'https://203.0.113.9:5080'
const tokenKey = 'v2rayn-api-session:' + encodeURIComponent(fixtureAddress)
let checked = 0
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addInitScript(({ history }) => {
      localStorage.setItem('v2rayn-api-endpoint-history', JSON.stringify(history))
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      window.EventSource = class { addEventListener() {} close() {} }
    }, { history: ['http://127.0.0.1:5080', 'https://203.0.113.7:5080'] })
    const page = await context.newPage()
    const errors = []
    let logins = 0
    let healthChecks = 0
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      const path = new URL(request.url()).pathname
      if (path === '/api/auth/login' && request.method() === 'POST') logins += 1
      if (path === '/api/health') healthChecks += 1
    })
    const fixture = applicationFixtures()
    function cors() {
      return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Max-Age': '600',
      }
    }
    await page.route('**/api/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors() })
      if (path === '/api/health') return route.fulfill({ json: { status: 'ok' }, headers: cors() })
      if (path === '/api/auth/login') return route.fulfill({ json: { success: true, data: { token: 'history-fixture-session' } }, headers: cors() })
      return route.fulfill({ json: { success: true, data: fixture[path] ?? [] }, headers: cors() })
    })
    async function shot(name) {
      for (const close of await page.locator('.toast-close').all()) if (await close.isVisible()) await close.click()
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${name}: no horizontal overflow`)
      if (output) await page.screenshot({ path: `${output}/${width}-${name}.png` })
    }
    const history = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) || '[]'), HISTORY_KEY)
    await page.goto(base)
    await page.locator('.auth-box').waitFor()
    const selector = page.locator('#backend-history')
    await selector.waitFor()
    assert.equal(await selector.locator('option').count(), 3, 'placeholder plus two stored addresses')
    assert.equal(await page.locator('#api-endpoint').inputValue(), '')
    await shot('login-history')
    await selector.selectOption('https://203.0.113.7:5080')
    assert.equal(await page.locator('#api-endpoint').inputValue(), 'https://203.0.113.7:5080')
    await page.waitForTimeout(250)
    assert.equal(logins, 0, 'choosing a history entry must not sign in')
    assert.equal(healthChecks, 0, 'choosing a history entry must not test the connection')
    const remove = page.getByRole('button', { name: labels.backend.removeHistory, exact: true })
    assert.equal(await remove.isEnabled(), true)
    await remove.click()
    assert.equal(await selector.locator('option').count(), 2)
    assert.deepEqual(await history(), ['http://127.0.0.1:5080'])
    assert.equal(await remove.isDisabled(), true, 'nothing selected means nothing to remove')
    await shot('login-history-removed')
    await page.locator('#api-endpoint').fill(fixtureAddress)
    await page.getByRole('button', { name: labels.backend.test, exact: true }).click()
    await page.locator('.toast', { hasText: labels.backend.reachable }).waitFor()
    await shot('login-history-remembered')
    assert.deepEqual(await history(), [fixtureAddress, 'http://127.0.0.1:5080'])
    assert.equal(healthChecks, 1)
    // A successful sign-in records the address too and never stores the Management Key.
    const managementKey = 'ui-history-fixture-key'
    await page.locator('#management-key').fill(managementKey)
    await page.getByRole('button', { name: labels.auth.connect, exact: true }).click()
    await page.locator('[data-profile-id="C"]').waitFor()
    assert.equal(logins, 1)
    assert.ok(await page.evaluate(key => Boolean(localStorage.getItem(key)), tokenKey), 'endpoint-scoped session token exists')
    assert.deepEqual(await history(), [fixtureAddress, 'http://127.0.0.1:5080'])
    assert.equal(await page.evaluate(secret => Object.values(localStorage).some(value => String(value).includes(secret)), managementKey), false, 'Management Key never enters storage')
    await shot('workspace-after-history-login')
    assert.deepEqual(errors, [])
    checked += 1
    await context.close()
  }
} finally { await browser.close() }
console.log(`Backend history browser regression: ${checked} viewports (select, remove, remember, sign-in, key exclusion) passed.`)
