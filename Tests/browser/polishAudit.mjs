// Screenshots + assertions for every module, long content, narrow viewports and UI feedback.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR || '/tmp/opencode/webui-polish/audit'
await mkdir(output, { recursive: true })
const ids = ['nodes', 'subscriptions', 'routing', 'settings', 'dns', 'maintenance', 'logs', 'templates']
const navOrder = ['nodes', 'subscriptions', 'routing', 'dns', 'settings', 'templates', 'maintenance', 'logs']
const audit = []
try {
  for (const width of [320, 390, 1920, 2560]) {
    const mobile = width <= 760
    const height = mobile ? 844 : width === 1920 ? 1080 : 1440
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
    await context.addInitScript(width => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-polish-fixture')
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      localStorage.setItem('v2rayn-web-theme', width === 390 || width === 2560 ? 'light' : 'dark')
      window.EventSource = class {
        constructor() { this.listeners = new Map(); window.__auditSource = this }
        addEventListener(name, callback) { this.listeners.set(name, callback) }
        removeEventListener(name) { this.listeners.delete(name) }
        close() { this.listeners.clear() }
      }
    }, width)
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const fixture = applicationFixtures()
    const originalNodes = fixture['/api/profiles']
    fixture['/api/profiles'] = Array.from({ length: 1000 }, (_, index) => ({
      ...originalNodes[index % 3], indexId: `audit-${index}`, isCurrent: index === 0,
      remarks: index < 3 ? 'Long node / 超长节点名 / '.repeat(18) + index : `Dense node ${index}`,
      speed: index === 0 ? 0 : 12.5, delay: index % 2 ? -1 : 0,
    }))
    fixture['/api/subscriptions'][2].url = 'https://subscription.example.invalid/' + 'long-path-'.repeat(200)
    fixture['/api/logs/page'].items = fixture['/api/logs/page'].items.map((entry, index) => ({ ...entry, message: index === 0 ? 'error ' + 'long-log-token-'.repeat(400) : entry.message }))
    fixture['/api/auth/sse-ticket'] = { ticket: 'audit-ticket' }
    let failRead = false
    let failSave = false
    let holdRead = false
    const releases = []
    await page.route('**/api/**', async route => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname === '/api/profiles' && holdRead) await new Promise(resolve => releases.push(resolve))
      if ((failRead && url.pathname === '/api/profiles') || (failSave && request.method() === 'PUT')) return route.fulfill({ status: 503, json: { success: false, code: 'fixture-request-failed' } })
      const data = url.pathname === '/api/profiles' && url.searchParams.get('filter') === 'no-matches' ? [] : fixture[url.pathname] ?? []
      return route.fulfill({ json: { success: true, data } })
    })
    await page.goto(base)
    await page.locator('[data-profile-id="audit-999"]').waitFor({ state: 'attached' })
    async function navigate(id) {
      const index = navOrder.indexOf(id)
      if (mobile && index >= 3) {
        await page.locator('.mobile-nav-more .action-menu-trigger').click()
        await page.locator('.mobile-nav-more .action-menu-item').nth(index - 3).click()
      } else await page.locator('.main-nav > .nav-tab').nth(index).click()
      await page.locator(`.${id}-page`).waitFor()
    }
    async function shot(id, state = 'default') {
      for (const close of await page.locator('.toast-close').all()) if (await close.isVisible()) await close.click()
      await page.screenshot({ path: `${output}/${width}-${id}-${state}.png` })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width} ${id} ${state}: no horizontal overflow`)
      audit.push({ width, height, module: id, state })
    }
    for (const id of ids) {
      await navigate(id)
      if (id === 'routing') await page.locator('.rule-row').first().waitFor()
      if (id === 'settings') await page.waitForFunction(() => document.querySelector('.settings-page input')?.value === '1145')
      if (id === 'dns') await page.waitForFunction(() => document.querySelector('.dns-page input')?.value === 'https://dns.example.invalid/dns-query')
      if (id === 'maintenance') await page.waitForFunction(() => document.querySelectorAll('.update-section').length >= 3)
      if (id === 'logs') await page.locator('.log-table tbody tr').nth(7).waitFor()
      if (id === 'templates') await page.locator('.template-editor').waitFor()
      await page.locator('.page-feedback[aria-busy="false"]').waitFor()
      await shot(id)
      if (id === 'nodes') {
        assert.match(await page.locator('[data-profile-id="audit-0"] .node-metric').nth(1).innerText(), /0$/)
        if (!mobile) {
          assert.equal(await page.locator('.profile-table td.address-cell').first().evaluate(element => getComputedStyle(element).display), 'table-cell', 'text truncation must not break native table cell alignment')
          await page.locator('.sort-button').filter({ hasText: 'Delay' }).click()
          await page.locator('th[aria-sort="ascending"]').waitFor()
        }
        await page.locator('[data-profile-id="audit-0"] .check-cell input').check()
        await page.locator('[data-profile-id="audit-1"] .check-cell input').check()
        assert.equal(await page.locator('.profile-table thead input').evaluate(element => element.indeterminate), true)
        await shot(id, 'batch-selection')
        const search = page.locator('.nodes-page .search-box input')
        holdRead = true
        await search.fill('pending')
        await search.press('Enter')
        await page.locator('.nodes-page .page-feedback[aria-busy="true"]').waitFor()
        await shot(id, 'loading')
        holdRead = false
        for (const release of releases.splice(0)) release()
        await page.locator('.nodes-page .page-feedback[aria-busy="false"]').waitFor()
        failRead = true
        await search.press('Enter')
        await page.locator('.nodes-page .page-feedback [role="alert"]').waitFor()
        await shot(id, 'error')
        failRead = false
        await search.fill('no-matches')
        await search.press('Enter')
        await page.locator('.nodes-page .empty-row').waitFor()
        assert.ok((await page.locator('.empty-row').innerText()).includes('No matching results'))
        await shot(id, 'empty-search')
        await search.fill('')
        await search.press('Enter')
        await page.locator('[data-profile-id="audit-999"]').waitFor({ state: 'attached' })
      }
      if (id === 'subscriptions') {
        fixture['/api/operations'] = ['network']
        await page.evaluate(() => window.__auditSource.listeners.get('subscription-progress')({ data: JSON.stringify({ subscriptionId: 'network', success: false, rawLog: 'Downloading subscription fixture…' }) }))
        await page.locator('[data-subscription-id="network"] .subscription-progress').waitFor()
        await shot(id, 'update-progress')
        fixture['/api/operations'] = []
      }
      if (id === 'settings') {
        await page.locator('.settings-page input').first().fill('20808')
        await page.locator('.draft-status.dirty').waitFor()
        await shot(id, 'dirty')
        // A navigation attempt must protect the draft, not discard it silently.
        const index = navOrder.indexOf('dns')
        if (mobile) { await page.locator('.mobile-nav-more .action-menu-trigger').click(); await page.locator('.mobile-nav-more .action-menu-item').nth(index - 3).click() }
        else await page.locator('.main-nav > .nav-tab').nth(index).click()
        await page.locator('.confirm-panel').waitFor()
        await page.keyboard.press('Escape')
        assert.ok(await page.locator('.settings-page').isVisible())
        failSave = true
        await page.locator('.save-bar > button').click()
        await page.locator('.settings-page .page-feedback [role="alert"]').waitFor()
        assert.ok(await page.locator('.draft-status.dirty').isVisible())
        await shot(id, 'save-error-draft-retained')
        failSave = false
        await page.locator('.save-bar > button').click()
        await page.waitForFunction(() => !document.querySelector('.draft-status.dirty'))
      }
      if (id === 'logs') {
        await page.getByRole('button', { name: 'Pause live logs', exact: true }).click()
        const before = await page.locator('.log-table tbody').innerText()
        await page.evaluate(() => window.__auditSource.listeners.get('log')({ data: JSON.stringify({ timestamp: '2026-10-09T00:00:00Z', source: 'Xray', message: 'must not append while paused' }) }))
        assert.equal(await page.locator('.log-table tbody').innerText(), before)
        await shot(id, 'paused')
        await page.getByRole('button', { name: 'Resume live logs', exact: true }).click()
        await page.locator('.compact-filter select').selectOption('errors')
        const filter = await page.locator('.log-search input').inputValue()
        assert.equal(new RegExp(filter).test('ERROR fixture'), true)
        await shot(id, 'level-text-filter')
      }
      if (id === 'dns') {
        await page.locator('.dns-page .section-tabs button').nth(2).click()
        await page.locator('.dns-core-column textarea').first().fill('{"fixture":"unsaved-xray"}')
        await page.locator('.dns-page .section-tabs button').nth(3).click()
        await page.locator('.dns-core-column textarea').first().fill('{"fixture":"unsaved-sing-box"}')
        await shot(id, 'multiple-core-drafts')
        await page.locator('.save-bar > button').click()
        await page.locator('.confirm-panel').waitFor()
        await shot(id, 'cross-core-save-confirmation')
        await page.keyboard.press('Escape')
        assert.equal(await page.locator('.dns-core-column textarea').first().inputValue(), '{"fixture":"unsaved-sing-box"}')
        await page.locator('.dns-page .page-header .button').click()
        await page.locator('.confirm-panel .button').last().click()
        await page.waitForFunction(() => !document.querySelector('.draft-status.dirty'))
      }
      if (id === 'templates') {
        const textarea = page.locator('.template-code').first()
        await textarea.focus()
        await textarea.evaluate(element => element.setSelectionRange(0, 0))
        await textarea.press('Tab')
        assert.ok((await textarea.inputValue()).startsWith('  '))
        await page.locator('.draft-status.dirty').waitFor()
        await shot(id, 'keyboard-dirty')
        await textarea.press('Control+Enter')
        await page.waitForFunction(() => !document.querySelector('.draft-status.dirty'))
      }
    }
    if (mobile) { await page.locator('.header-more').click(); await page.locator('.mobile-core-entry').click() }
    await shot('runtime')
    assert.deepEqual(errors, [], `${width}: no browser runtime errors`)
    await context.close()
  }
} finally { await browser.close() }
await writeFile(`${output}/audit.json`, JSON.stringify(audit, null, 2))
console.log(`Polish audit: ${audit.length} screenshots across all modules, 320/390px, 1080p/1440p, long text and loading/error/dirty/live states passed.`)
