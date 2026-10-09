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
const seeded = ['http://127.0.0.1:5080', 'https://203.0.113.7:5080']
let checked = 0
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addInitScript(({ history }) => {
      localStorage.setItem('v2rayn-api-endpoint-history', JSON.stringify(history))
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      window.EventSource = class { addEventListener() {} close() {} }
    }, { history: seeded })
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
    const toggle = page.locator('.combo-toggle')
    const menu = page.locator('.combo-menu')
    const rows = page.locator('.combo-menu .history-row')
    await toggle.waitFor()
    assert.equal(await page.locator('#backend-history').count(), 0, 'history lives inside the address combobox, not as a separate control')
    assert.equal(await page.locator('.backend-history-trigger').count(), 0, 'no standalone history button remains')
    await toggle.click()
    await menu.waitFor()
    assert.equal(await rows.count(), 2)
    await shot('login-history-menu')
    // Escape closes the dropdown and returns focus to its toggle.
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'detached' })
    assert.equal(await toggle.evaluate(element => document.activeElement === element), true, 'focus returns to the dropdown toggle')
    // Selecting an entry fills the address and never connects on its own.
    await toggle.click()
    await menu.waitFor()
    await rows.filter({ hasText: '203.0.113.7:5080' }).locator('.history-choice').click()
    await menu.waitFor({ state: 'detached' })
    assert.equal(await page.locator('#api-endpoint').inputValue(), 'https://203.0.113.7:5080')
    assert.equal(await page.locator('#api-endpoint').evaluate(element => document.activeElement === element), true, 'focus returns to the address input')
    await page.waitForTimeout(250)
    assert.equal(logins, 0, 'choosing a history entry must not sign in')
    assert.equal(healthChecks, 0, 'choosing a history entry must not test the connection')
    await shot('login-history-selected')
    // Removal keeps the dropdown open and updates this browser only; the empty state is explicit.
    await toggle.click()
    await menu.waitFor()
    await rows.filter({ hasText: '203.0.113.7:5080' }).getByRole('menuitem', { name: labels.backend.removeHistory, exact: true }).click()
    assert.equal(await rows.count(), 1)
    assert.deepEqual(await history(), ['http://127.0.0.1:5080'])
    await rows.filter({ hasText: '127.0.0.1:5080' }).getByRole('menuitem', { name: labels.backend.removeHistory, exact: true }).click()
    assert.equal(await rows.count(), 0)
    assert.ok(await menu.getByText(labels.backend.historyEmpty).isVisible())
    assert.deepEqual(await history(), [])
    await shot('login-history-empty')
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'detached' })
    assert.equal(await toggle.count(), 0, 'the dropdown toggle hides while nothing is saved')
    // A successful test connection records the address again.
    await page.locator('#api-endpoint').fill(fixtureAddress)
    await page.getByRole('button', { name: labels.backend.test, exact: true }).click()
    await page.locator('.toast', { hasText: labels.backend.reachable }).waitFor()
    assert.deepEqual(await history(), [fixtureAddress])
    assert.equal(await toggle.count(), 1)
    await shot('login-history-remembered')
    assert.equal(healthChecks, 1)
    // A successful sign-in records the address too and never stores the Management Key.
    const managementKey = 'ui-history-fixture-key'
    await page.locator('#management-key').fill(managementKey)
    await page.getByRole('button', { name: labels.auth.connect, exact: true }).click()
    await page.locator('[data-profile-id="C"]').waitFor()
    assert.equal(logins, 1)
    assert.ok(await page.evaluate(key => Boolean(localStorage.getItem(key)), tokenKey), 'endpoint-scoped session token exists')
    assert.deepEqual(await history(), [fixtureAddress])
    assert.equal(await page.evaluate(secret => Object.values(localStorage).some(value => String(value).includes(secret)), managementKey), false, 'Management Key never enters storage')
    await shot('workspace-after-history-login')
    assert.deepEqual(errors, [])
    checked += 1
    await context.close()
  }
} finally { await browser.close() }
console.log(`Backend history browser regression: ${checked} viewports (combobox open, Escape focus, select, per-entry remove, empty state, remember, sign-in, key exclusion) passed.`)
