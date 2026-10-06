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
      localStorage.setItem('v2rayn-web-token', 'isolated-batch-fixture')
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
      '/api/profile-groups': [], '/api/subscriptions': [], '/api/operations': [],
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
    for (const [action, key] of [['tcping', 'tcping'], ['realping', 'realping'], ['speedtest', 'speedtest'], ['udpTest', 'udp']]) {
      await openMenu('B')
      assert.equal(await row('A').getAttribute('aria-selected'), 'true')
      assert.equal(await row('B').getAttribute('aria-selected'), 'true')
      await assertSubmission(action, ['A', 'B'], () => page.locator('.context-menu > button').filter({ hasText: labels.nodes[key] }).click())
    }
    if (width <= 760) {
      await openMenu('A', true)
      await assertSubmission('speedtest', ['A', 'B'], () => page.locator('.context-menu > button').filter({ hasText: labels.nodes.speedtest }).click())
    }
    await openMenu('C', width <= 760)
    await assertSubmission('speedtest', ['C'], () => page.locator('.context-menu > button').filter({ hasText: labels.nodes.speedtest }).click())
    assert.equal(await checkbox('A').isChecked(), false)
    assert.equal(await checkbox('B').isChecked(), false)
    await checkbox('C').uncheck()
    await checkbox('A').check()
    await checkbox('B').check()
    await row('A').locator('.remark-cell').click()
    for (const [action, shortcut] of [['tcping', 'Control+o'], ['realping', 'Control+r'], ['speedtest', 'Control+t']]) {
      await assertSubmission(action, ['A', 'B'], () => page.keyboard.press(shortcut))
    }
    assert.deepEqual(errors, [], 'no browser runtime errors')
    await context.close()
  }
} finally {
  await browser.close()
}
console.log(`Batch speedtest browser regression: ${checked} desktop/mobile request payloads passed.`)
