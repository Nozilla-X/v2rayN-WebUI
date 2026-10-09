// Optional browser regression against a local Vite server; every API call is mocked.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const labels = JSON.parse(await readFile(new URL('../../Src/Locales/zh-CN.json', import.meta.url), 'utf8'))
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
let checked = 0
try {
  for (const width of [390, 502, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 760, hasTouch: width <= 760 })
    await context.addInitScript(() => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-batch-fixture')
      localStorage.setItem('v2rayn-web-locale', 'zh-CN')
      window.EventSource = class { addEventListener() {} close() {} }
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    const fixtures = {
      '/api/setup/status': { setupRequired: false },
      '/api/status': { coreRunning: true, coreType: 'Xray', runtimeState: 'running', statisticsEnabled: true, listeners: [], traffic: {} },
      '/api/editor-options': { profiles: { configTypes: ['VLESS'], coreTypes: ['Xray'] } },
      '/api/profiles': ['A', 'B', 'C'].map((indexId, i) => ({ indexId, remarks: `Node ${indexId}`, configType: 'VLESS', protocol: 'vless', address: `192.0.2.${i + 1}`, port: 443, network: 'raw', streamSecurity: 'reality', isCurrent: indexId === 'A' })),
      '/api/profile-groups': [{ id: '', name: '全部', profileCount: 3 }, { id: 'fixture-sub', name: '测试订阅', profileCount: 3 }],
      '/api/subscriptions': [{ id: 'fixture-sub', remarks: '测试订阅', url: 'https://example.invalid/subscription', enabled: true }], '/api/operations': [],
      '/api/settings': { inbound: { localPort: 1145 }, options: {} },
      '/api/settings/routing-profiles': [], '/api/logs': { items: [], total: 0 },
    }
    await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: fixtures[new URL(route.request().url()).pathname] ?? [] } }))
    await page.goto(base)
    const row = id => page.locator(`[data-profile-id="${id}"]`)
    const checkbox = id => row(id).locator('.check-cell input')
    await row('C').waitFor()
    await checkbox('A').check()
    await checkbox('B').check()

    async function openMenu(id, mobileEntry = false) {
      if (mobileEntry) await row(id).locator('.row-more').click()
      else await row(id).locator('.remark-cell').click({ button: 'right' })
      await page.locator('.context-menu').waitFor()
    }
    async function assertSubmission(action, expectedIds, trigger) {
      const request = page.waitForRequest(req => new URL(req.url()).pathname === '/api/speedtests' && req.method() === 'POST')
      await trigger()
      assert.deepEqual((await request).postDataJSON(), { action, profileIds: expectedIds }, `${width}px ${action} request must use the selected batch`)
      checked++
    }
    async function clickTestAction(name) {
      await page.locator('.context-menu .context-flyout-trigger').filter({ hasText: labels.nodes.testMenu }).click()
      await page.locator('.flyout-menu-popup').getByRole('menuitem', { name }).first().click()
    }
    for (const [action, key] of [['tcping', 'tcping'], ['realping', 'realping'], ['speedtest', 'speedtest'], ['udpTest', 'udp']]) {
      await openMenu('B')
      assert.equal(await row('A').getAttribute('aria-selected'), 'true')
      assert.equal(await row('B').getAttribute('aria-selected'), 'true')
      await assertSubmission(action, ['A', 'B'], () => clickTestAction(labels.nodes[key]))
    }
    if (width <= 760) {
      await openMenu('A', true)
      await assertSubmission('speedtest', ['A', 'B'], () => clickTestAction(labels.nodes.speedtest))
    }
    await openMenu('C', width <= 760)
    await assertSubmission('speedtest', ['C'], () => clickTestAction(labels.nodes.speedtest))
    assert.equal(await checkbox('A').isChecked(), false)
    assert.equal(await checkbox('B').isChecked(), false)
    await checkbox('C').uncheck()
    await checkbox('A').check()
    await checkbox('B').check()
    await row('A').locator('.remark-cell').click()
    for (const [action, shortcut] of [['tcping', '1'], ['realping', '2'], ['speedtest', '3'], ['udpTest', '4'], ['fastRealping', '5'], ['mixedtest', '6']]) {
      await assertSubmission(action, ['A', 'B'], () => page.keyboard.press(shortcut))
    }
    if (width <= 760) {
      const tools = page.locator('.mobile-node-tools')
      const trigger = tools.locator('.action-menu-trigger')
      const add = page.locator('.nodes-page-toolbar .toolbar-main > .action-dropdown:not(.mobile-node-tools):not(.node-batch-actions) .action-menu-trigger')
      const toolsBounds = await trigger.boundingBox()
      const addBounds = await add.boundingBox()
      assert.ok(toolsBounds.x + toolsBounds.width <= addBounds.x, 'Tools belongs immediately before Add')
      assert.ok(toolsBounds.height >= 44)
      for (const icon of await page.locator('.group-toolbar .node-toolbar-action').all()) assert.equal(await icon.isVisible(), false, 'loose mobile icon row is replaced, not duplicated')
      const openTools = () => trigger.click()
      await openTools()
      const menu = tools.locator('.action-menu-popup')
      assert.equal(await menu.locator('button').count(), 5, 'all five existing utilities remain available')
      assert.ok(await menu.getByRole('menuitem', { name: labels.subscriptions.editSubscription, exact: true }).isDisabled(), 'editing stays disabled for all-groups selection')
      const fit = menu.getByRole('menuitemcheckbox')
      assert.equal(await fit.getAttribute('aria-checked'), 'false')
      await fit.click()
      assert.ok((await page.locator('.table-wrap').getAttribute('class')).includes('auto-fit-columns'))
      await openTools()
      assert.equal(await fit.getAttribute('aria-checked'), 'true')
      await fit.focus()
      await page.keyboard.press('Enter')
      assert.equal((await page.locator('.table-wrap').getAttribute('class')).includes('auto-fit-columns'), false)
      for (const [action, key] of [['fastRealping', 'fastRealping'], ['mixedtest', 'mixedtest']]) {
        await openTools()
        await assertSubmission(action, ['A', 'B'], () => menu.getByRole('menuitem', { name: labels.nodes[key], exact: true }).click())
      }
      await openTools()
      await menu.getByRole('menuitem', { name: labels.subscriptions.addSubscription, exact: true }).click()
      await page.locator('.modal-panel').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('.group-chip').filter({ hasText: '测试订阅' }).click()
      await page.locator('.group-chip.selected').filter({ hasText: '测试订阅' }).waitFor()
      await openTools()
      const edit = menu.getByRole('menuitem', { name: labels.subscriptions.editSubscription, exact: true })
      assert.equal(await edit.isDisabled(), false)
      await edit.click()
      await page.locator('.modal-panel').waitFor()
      await page.keyboard.press('Escape')
      await page.locator('.header-more').click()
      await page.locator('.locale-select').selectOption('en-US')
      await page.keyboard.press('Escape')
      await checkbox('A').check()
      await checkbox('B').check()
      const title = await page.locator('.page-title').boundingBox()
      const actions = await page.locator('.nodes-page-toolbar .toolbar-main').boundingBox()
      assert.ok(title.y + title.height <= actions.y || title.x + title.width <= actions.x, 'English title and utilities do not overlap')
      assert.ok(await page.evaluate(width => document.documentElement.scrollWidth <= width, width))
    } else {
      assert.equal(await page.locator('.mobile-node-tools').isVisible(), false, 'desktop keeps its original toolbar')
      for (const icon of await page.locator('.group-toolbar .node-toolbar-action').all()) assert.ok(await icon.isVisible())
    }
    assert.deepEqual(errors, [], 'no browser runtime errors')
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(`Batch speedtest and node-tools browser regression: ${checked} desktop/mobile request payloads passed.`)
