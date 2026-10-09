// Synthetic data only: verify safe shortcuts, speedtest SSE races and sticky-header location.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
try {
  for (const width of [390, 1920]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addInitScript(() => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-followup-fixture')
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      localStorage.setItem('v2rayn-web-theme', 'dark')
      window.EventSource = class {
        constructor() { this.listeners = new Map(); window.__followupEvents = this }
        addEventListener(name, handler) { this.listeners.set(name, handler) }
        removeEventListener(name) { this.listeners.delete(name) }
        close() { this.listeners.clear() }
      }
    })
    const fixture = applicationFixtures()
    fixture['/api/profiles'] = Array.from({ length: 80 }, (_, index) => ({ ...fixture['/api/profiles'][0], indexId: `fixture-${index}`, remarks: `Synthetic node ${index}`, address: '198.51.100.10', isCurrent: index === 10, delay: 10, speed: 0 }))
    fixture['/api/auth/sse-ticket'] = { ticket: 'fixture-ticket' }
    let holdProfiles = false
    const releases = []
    const mutations = []
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', async route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() !== 'GET') mutations.push({ path, method: request.method(), body: request.postData() ? request.postDataJSON() : null })
      if (path === '/api/speedtests' && request.method() === 'POST') fixture['/api/operations'] = ['speedtest']
      // Capture the old body BEFORE the SSE results, just as a delayed real response can do.
      const response = JSON.stringify({ success: true, data: fixture[path] ?? [] })
      if (path === '/api/profiles' && holdProfiles) await new Promise(resolve => releases.push(resolve))
      await route.fulfill({ contentType: 'application/json', body: response })
    })
    await page.goto(base)
    await page.locator('[data-profile-id="fixture-79"]').waitFor({ state: 'attached' })
    const row = page.locator('[data-profile-id="fixture-10"]')
    if (width > 760) {
      await page.locator('.table-wrap').evaluate(wrap => {
        const row = wrap.querySelector('[data-profile-id="fixture-10"]')
        wrap.scrollTop += row.getBoundingClientRect().top - wrap.getBoundingClientRect().top + row.offsetHeight + 100
      })
      await page.locator('.locate-current').click()
      const position = await row.evaluate(row => ({ rowTop: row.getBoundingClientRect().top, headerBottom: row.closest('table').querySelector('th').getBoundingClientRect().bottom }))
      assert.ok(position.rowTop >= position.headerBottom - 1, 'locating current must not hide it under the sticky header')
    } else {
      await page.locator('.locate-current').click()
      assert.ok((await row.boundingBox()).y + (await row.boundingBox()).height <= (await page.locator('.main-nav').boundingBox()).y + 1, 'mobile current node must not be covered by bottom navigation')
    }
    if (output) await page.screenshot({ path: `${output}/${width}-located-current.png` })
    await row.locator('.remark-cell').click({ button: 'right' })
    await page.locator('.context-menu').waitFor()
    await page.locator('.context-menu .context-flyout-trigger').first().click()
    await page.locator('.flyout-menu-popup').waitFor()
    assert.deepEqual(await page.locator('.flyout-menu-popup .menu-shortcut').allTextContents(), ['1', '2', '3', '4', '5', '6'])
    if (output) await page.screenshot({ path: `${output}/${width}-safe-menu-shortcuts.png` })
    await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await row.locator('.remark-cell').click()
    const tcpRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/speedtests' && request.method() === 'POST')
    await page.keyboard.press('1')
    assert.deepEqual((await tcpRequest).postDataJSON(), { action: 'tcping', profileIds: ['fixture-10'] })
    await page.locator('.operation-status').waitFor()
    holdProfiles = true
    const search = page.locator('.nodes-page .search-box input')
    await search.press('Enter')
    await page.locator('.speedtest-refresh').waitFor()
    assert.equal(await page.locator('.nodes-page > .page-feedback').count(), 0, 'test loading belongs next to Stop, not a separate row')
    const stop = await page.locator('.operation-status .link-button').boundingBox()
    const loading = await page.locator('.speedtest-refresh').boundingBox()
    assert.ok(loading.x >= stop.x + stop.width || loading.y >= stop.y + stop.height, 'loading follows Stop in the status row')
    if (output) await page.screenshot({ path: `${output}/${width}-speedtest-loading.png` })
    await page.evaluate(() => window.__followupEvents.listeners.get('speedtest-result')({ data: JSON.stringify({ indexId: 'fixture-10', delay: 123, speed: null, ipInfo: null }) }))
    await page.waitForFunction(() => document.querySelector('[data-profile-id="fixture-10"] .delay-cell')?.textContent === '123')
    holdProfiles = false
    for (const release of releases.splice(0)) release()
    await page.locator('.speedtest-refresh').waitFor({ state: 'detached' })
    assert.equal(await row.locator('.delay-cell').innerText(), '123', 'old profiles response cannot overwrite the new SSE value')
    fixture['/api/profiles'][10].delay = 123
    fixture['/api/operations'] = []
    await page.evaluate(() => window.__followupEvents.listeners.get('speedtest-result')({ data: JSON.stringify({ indexId: '', delay: null, speed: null, rawResult: 'Synthetic terminal status' }) }))
    await page.locator('.operation-status').waitFor({ state: 'detached' })
    const testsBeforeTyping = mutations.filter(item => item.path === '/api/speedtests').length
    await search.fill('3')
    assert.equal(mutations.filter(item => item.path === '/api/speedtests').length, testsBeforeTyping, 'input typing does not trigger row shortcuts')
    await page.locator('#workspace').focus()
    await page.keyboard.press('3')
    assert.equal(mutations.filter(item => item.path === '/api/speedtests').length, testsBeforeTyping, 'shortcuts require row focus')
    assert.equal(context.pages().length, 1, 'application actions do not open a browser tab')
    if (output) await page.screenshot({ path: `${output}/${width}-completed-and-located.png` })
    assert.deepEqual(errors, [])
    await context.close()
  }
} finally { await browser.close() }
console.log('Node followups passed: safe row shortcut, inline loading, SSE result race, completion state and sticky-header location.')
