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
        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 760, hasTouch: width <= 760, colorScheme: scenario === 'empty' ? 'light' : 'dark' })
        await context.addInitScript(() => {
          localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-layout-fixture')
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
          '/api/profiles': [
            { indexId: 'node-1', remarks: name, configType: 'VLESS', protocol: 'vless', address: '192.0.2.99', port: 443, network: 'raw', streamSecurity: 'reality', isCurrent: true, subscriptionName: 'Test group', ipInfo: 'Test IP', delay: 0, speed: 0, todayUp: 308, todayDown: 347, totalUp: 308, totalDown: 347 },
            { indexId: 'node-2', remarks: 'Second node', configType: 'Hysteria2', protocol: 'hysteria2', address: '192.0.2.100', port: 443, network: 'udp', streamSecurity: 'tls', isCurrent: false, delay: 82, speed: 20 },
          ],
          '/api/profile-groups': [],
          '/api/subscriptions': [],
          '/api/operations': [],
          '/api/settings': { inbound: { localPort: 1145 }, showIpInfoColumn: running, options: {} },
          '/api/settings/routing-profiles': [{ id: 'route-1', remarks: 'V4-绕过大陆(Whitelist)', isActive: true }, { id: 'route-2', remarks: '备用规则', isActive: false }],
          '/api/settings/routing-profiles/route-1/rules': [],
          '/api/logs': { items: [], total: 0 },
        }
        await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: fixtures[new URL(route.request().url()).pathname] ?? [] } }))
        await page.goto(base)
        if (width <= 760) {
          await page.waitForFunction(running => document.querySelector('.mobile-core-summary strong')?.textContent === (running ? '运行中' : '已停止'), running)
          assert.equal(await page.locator('.runtime-strip, .connection-strip').count(), 0, 'Core cards are not mounted on the main mobile page')
          assert.ok((await page.locator('.mobile-core-summary').boundingBox()).height <= 44, 'mobile status stays a single lightweight row')
        } else await page.waitForFunction(() => document.querySelector('#runtime-route')?.value === 'route-1')
        const node = page.locator('[data-profile-id="node-1"]')
        await node.waitFor()
        const details = node.locator('.mobile-node-details button')
        if (width <= 760) {
          const collapsed = await node.boundingBox()
          if (scenario !== 'long') assert.ok(collapsed.height < 200, 'compact node summary does not need a separate protocol row')
          const capsule = await node.locator('.mobile-node-type').boundingBox()
          assert.ok(capsule.width < 70 && capsule.height <= 24, 'protocol capsule follows its text width')
          const longerCapsule = await page.locator('[data-profile-id="node-2"] .mobile-node-type').boundingBox()
          assert.ok(longerCapsule.width > capsule.width && longerCapsule.width < 90, 'longer protocol names retain intrinsic capsule sizing')
          const identity = await node.locator('.remark-cell').boundingBox()
          assert.ok(capsule.y >= identity.y && capsule.y + capsule.height <= identity.y + identity.height, 'protocol capsule belongs in the title row, including wrapped long names')
          assert.ok(await node.locator('.mobile-node-transport').isVisible(), 'transport/security stay visible beside endpoint')
          for (const badge of await node.locator('.node-badge').all()) assert.equal(await badge.isVisible(), false, 'desktop protocol cells do not become stretched mobile boxes')
          const input = await node.locator('.check-cell input').boundingBox()
          assert.ok(input.y - collapsed.y < 40, 'selection checkbox belongs at the top, not the middle')
          assert.equal(await node.locator('.node-detail-cell').first().isVisible(), false)
          assert.ok(await node.locator('.mobile-node-port').isVisible(), 'port is retained in endpoint summary')
          await details.focus()
          await page.keyboard.press('Enter')
          assert.equal(await details.getAttribute('aria-expanded'), 'true')
          assert.equal(await node.getAttribute('aria-selected'), 'false', 'expanding details does not select a node')
          for (const cell of await node.locator('.node-detail-cell').all()) assert.ok(await cell.isVisible(), 'all secondary fields are reachable')
          assert.equal(await node.locator('.ip-cell').count(), running ? 1 : 0, 'IP capability is respected in details')
          assert.ok((await node.textContent()).includes('308 B'), 'traffic values are preserved')
          await details.click()
          await node.locator('.check-cell input').check()
          assert.equal(await node.getAttribute('aria-selected'), 'true')
          await node.locator('.row-more').click()
          await page.locator('.context-menu').waitFor()
          await page.keyboard.press('Escape')
          if (output && scenario === 'short' && running) {
            await page.locator('.profile-table').evaluate(el => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 80 }))
            await page.screenshot({ path: `${output}/${width}-nodes.png` })
          }
        } else {
          assert.equal(await details.isVisible(), false, 'desktop does not gain a details column')
          for (const cell of await node.locator('.node-detail-cell').all()) assert.ok(await cell.isVisible(), 'desktop retains dense fields')
        }
        await page.locator('.main-nav > .nav-tab').nth(2).click()
        await page.locator('.routing-page').waitFor()
        if (output && scenario === 'short' && running) await page.screenshot({ path: `${output}/${width}-routing.png` })
        async function openCorePanel() {
          await page.locator('.header-more').click()
          await page.locator('.mobile-core-entry').click()
          await page.locator('.core-panel').waitFor()
        }
        if (width <= 760) {
          assert.ok((await page.locator('.page-title').boundingBox()).y < 200, 'routing content starts near the top, including with long node names')
          await openCorePanel()
          await page.waitForFunction(() => document.querySelector('#runtime-route')?.value === 'route-1')
          assert.equal(await page.locator('.runtime-strip').count(), 1, 'panel reuses a single RuntimeStrip')
          assert.equal(await page.locator('.connection-strip').count(), 1, 'panel reuses a single ConnectionStrip')
        }
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
          assert.ok(layout.title < 200, 'Core panel does not consume the main page layout')
        }
        assert.equal(layout.controls[0].disabled, running, 'start disabled only while running')
        assert.equal(layout.controls[1].disabled, !running, 'restart follows runtime state')
        assert.equal(layout.controls[2].disabled, !running, 'stop follows runtime state')
        if (width <= 760) {
          const panel = page.locator('.core-panel')
          assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden', 'Core panel locks background scrolling')
          if (output && scenario === 'short' && running) await page.screenshot({ path: `${output}/${width}-core-panel.png` })
          const bounds = await panel.boundingBox()
          assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 844, 'Core panel stays within viewport')
          const focusable = panel.locator('button:not(:disabled), select:not(:disabled)')
          await focusable.first().focus()
          await page.keyboard.press('Shift+Tab')
          assert.ok(await focusable.last().evaluate(el => el === document.activeElement), 'reverse Tab stays inside panel')
          await page.keyboard.press('Tab')
          assert.ok(await focusable.first().evaluate(el => el === document.activeElement), 'Tab stays inside panel')
          const action = running ? 'restart' : 'start'
          await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === `/api/core/${action}` && response.request().method() === 'POST'),
            page.locator('.core-actions button').nth(running ? 1 : 0).click(),
          ])
          await page.waitForFunction(() => [...document.querySelectorAll('.core-actions button')].some(button => !button.disabled))
          if (running) {
            await Promise.all([
              page.waitForResponse(response => new URL(response.url()).pathname === '/api/core/stop' && response.request().method() === 'POST'),
              page.locator('.core-actions button').nth(2).click(),
            ])
          }
          await Promise.all([
            page.waitForResponse(response => new URL(response.url()).pathname === '/api/settings/routing-profiles/route-2/activate' && response.request().method() === 'POST'),
            page.locator('#runtime-route').selectOption('route-2'),
          ])
          await page.keyboard.press('Escape')
          assert.equal(await panel.count(), 0, 'Escape closes the panel')
          assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflowY), 'hidden', 'closing the panel restores background scrolling')
          assert.ok(await page.locator('.header-more').evaluate(el => el === document.activeElement), 'focus returns to the visible App Bar entry')
          await openCorePanel()
          await page.locator('.core-panel-shade').click({ position: { x: 2, y: 2 } })
          assert.equal(await panel.count(), 0, 'outside click closes the panel')
          await openCorePanel()
          await page.setViewportSize({ width: 1440, height: 1000 })
          await page.locator('.core-status-host .runtime-strip').waitFor()
          assert.equal(await panel.count(), 0, 'desktop resize closes the modal and restores the original strips')
          assert.equal(await page.locator('.runtime-strip').count(), 1)
          await page.setViewportSize({ width, height: 844 })
          await page.locator('.mobile-core-summary').waitFor()
          assert.equal(await panel.count(), 0, 'returning to mobile does not reopen the panel')
          assert.equal(await page.locator('.runtime-strip, .connection-strip').count(), 0)
          if (scenario === 'empty' && !running) {
            fixtures['/api/status'].runtimeState = 'faulted'
            fixtures['/api/status'].runtimeFailure = 'Isolated fixture failure'
            await page.locator('.header-more').click()
            await page.locator('.header-right button[title]').click()
            await page.waitForFunction(() => document.querySelector('.mobile-core-summary strong')?.textContent === '运行异常')
            assert.ok(await page.locator('.mobile-core-summary .danger-text').isVisible(), 'runtime faults remain visible without opening Core controls')
            await page.keyboard.press('Escape')
          }
        }
        assert.deepEqual(errors, [], 'no browser errors')
        checks++
        await context.close()
      }
    }
  }
} finally {
  await browser.close()
}
console.log(`Mobile status and node-card browser regression: ${checks} viewport/content/runtime combinations passed.`)
