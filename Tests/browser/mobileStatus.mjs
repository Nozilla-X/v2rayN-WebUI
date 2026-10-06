// Optional browser regression: run against a local Vite server (no real Backend).
// PLAYWRIGHT_MODULE may point to an externally installed playwright/index.mjs.
// WEBUI_URL defaults to http://127.0.0.1:5178. SCREENSHOT_DIR is optional.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
let checks = 0
try {
  for (const width of [360, 390, 430, 502, 760, 1440]) {
    for (const [scenario, name] of [['short', 'Test-node-k3skg7b3'], ['long', '移动端长节点名称 / Hong Kong '.repeat(5)], ['empty', '']]) {
      for (const running of [true, false]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 760, hasTouch: width <= 760 })
        await context.addInitScript(() => {
          localStorage.setItem('v2rayn-web-token', 'isolated-layout-fixture')
          localStorage.setItem('v2rayn-web-locale', 'zh-CN')
          window.EventSource = class { addEventListener() {} close() {} }
        })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        const fixtures = {
          '/api/setup/status': { setupRequired: false },
          '/api/status': { coreRunning: running, coreType: 'Xray', runtimeState: running ? 'running' : 'stopped', currentProfileName: name, statisticsEnabled: true, runtime: 'v2rayN - V7.25.5 - X64', traffic: { proxyUp: 0, proxyDown: 0, directUp: 0, directDown: 0 }, listeners: [{ name: 'local', listening: running, listenAddress: '0.0.0.0', port: 1145, protocols: ['http', 'socks', 'udp'] }] },
          '/api/editor-options': { profiles: { configTypes: ['VLESS'], coreTypes: ['Xray'] } },
          '/api/profiles': [],
          '/api/profile-groups': [],
          '/api/subscriptions': [],
          '/api/operations': [],
          '/api/settings': { inbound: { localPort: 1145 }, options: {} },
          '/api/settings/routing-profiles': [{ id: 'route-1', remarks: 'V4-绕过大陆(Whitelist)', isActive: true }],
          '/api/settings/routing-profiles/route-1/rules': [],
          '/api/logs': { items: [], total: 0 },
        }
        await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: fixtures[new URL(route.request().url()).pathname] ?? [] } }))
        await page.goto(base)
        await page.waitForFunction(() => document.querySelector('#runtime-route')?.value === 'route-1')
        await page.locator('.main-nav > .nav-tab').nth(2).click()
        await page.locator('.routing-page').waitFor()
        const layout = await page.evaluate(() => {
          const box = selector => document.querySelector(selector).getBoundingClientRect()
          const inner = selector => {
            const el = document.querySelector(selector)
            const css = getComputedStyle(el)
            return el.getBoundingClientRect().width - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight) - parseFloat(css.borderLeftWidth) - parseFloat(css.borderRightWidth)
          }
          return { pageWidth: document.documentElement.scrollWidth, statusInner: inner('.runtime-strip'), status: box('.runtime-main').width, actions: box('.core-actions').width, route: box('#runtime-route').width, connectionInner: inner('.connection-strip'), listeners: box('.listener-list').width, traffic: box('.traffic-list').width, title: box('.page-title').top, controls: [...document.querySelectorAll('.core-actions button')].map(el => ({ height: el.getBoundingClientRect().height, disabled: el.disabled })) }
        })
        assert.ok(layout.pageWidth <= width, `${width} ${scenario}: page overflow`)
        if (width <= 760) {
          for (const group of ['status', 'actions']) assert.ok(Math.abs(layout[group] - layout.statusInner) < 1, `${width} ${scenario}: ${group} shrinks to content width`)
          for (const group of ['listeners', 'traffic']) assert.ok(Math.abs(layout[group] - layout.connectionInner) < 1, `${width} ${scenario}: ${group} shrinks to content width`)
          assert.ok(Math.abs(layout.route - (layout.statusInner - 56)) < 1, 'route select fills the value column')
          assert.ok(layout.controls.every(control => control.height >= 44), 'Core actions retain touch targets')
          if (scenario !== 'long') assert.ok(layout.title < 520, 'short/empty status leaves routing content on the first screen')
        }
        assert.equal(layout.controls[0].disabled, running, 'start disabled only while running')
        assert.equal(layout.controls[1].disabled, !running, 'restart follows runtime state')
        assert.equal(layout.controls[2].disabled, !running, 'stop follows runtime state')
        assert.deepEqual(errors, [], 'no browser errors')
        if (output && scenario === 'short' && running) await page.screenshot({ path: `${output}/${width}-routing.png` })
        checks++
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
console.log(`Mobile status browser regression: ${checks} viewport/content/runtime combinations passed.`)
