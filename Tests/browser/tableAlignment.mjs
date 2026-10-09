import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
try {
  for (const scale of [1, 1.25, 1.5]) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: scale })
    await context.addInitScript(() => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-alignment-fixture')
      localStorage.setItem('v2rayn-web-locale', 'zh-CN')
      localStorage.setItem('v2rayn-web-theme', 'dark')
      window.EventSource = class { addEventListener() {} close() {} }
    })
    const fixture = applicationFixtures()
    // RFC 5737 documentation-only addresses; never copy real addresses from user screenshots.
    fixture['/api/profiles'] = fixture['/api/profiles'].slice(0, 2).map((profile, index) => ({ ...profile, address: index ? '203.0.113.20' : '198.51.100.10', subscriptionName: 'Fixture group', delay: index ? 154 : 139, speed: 0, ipInfo: 'Fixture IP' }))
    fixture['/api/settings'].showIpInfoColumn = true
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: fixture[new URL(route.request().url()).pathname] ?? [] } }))
    await page.goto(base)
    await page.locator('.profile-table td.ip-cell').first().waitFor()
    const rows = await page.locator('.profile-table tbody tr').evaluateAll(rows => rows.map(row => {
      function textCenter(selector) {
        const cell = row.querySelector(selector)
        const range = document.createRange()
        range.selectNodeContents(cell)
        const text = range.getBoundingClientRect()
        return { center: text.y + text.height / 2, align: getComputedStyle(cell).verticalAlign, display: getComputedStyle(cell).display }
      }
      return { port: textCenter('.node-port'), address: textCenter('.address-cell'), group: textCenter('.group-cell'), ip: textCenter('.ip-cell') }
    }))
    for (const row of rows) for (const key of ['address', 'group', 'ip']) {
      assert.equal(row[key].align, 'middle')
      assert.equal(row[key].display, 'table-cell')
      assert.ok(Math.abs(row[key].center - row.port.center) <= 1, `${scale}x ${key}: text must align with port, not the bottom of the row`)
    }
    if (output) await page.locator('.profile-table').screenshot({ path: `${output}/table-alignment-${scale}x.png` })
    assert.deepEqual(errors, [])
    await context.close()
  }
} finally { await browser.close() }
console.log('Node address/group/IP text alignment passed at 1x, 1.25x and 1.5x display scale.')
