// Whole-app responsive regression. All API, clipboard and update actions are isolated fixtures.
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
const output = process.env.SCREENSHOT_DIR
if (output) await mkdir(output, { recursive: true })
const ids = ['nodes', 'subscriptions', 'routing', 'dns', 'settings', 'templates', 'maintenance', 'logs']
const metrics = []
let requestsChecked = 0
try {
  for (const width of [360, 390, 430, 502, 760, 1280, 1440, 1920]) {
    for (const locale of ['zh-CN', 'en-US']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width <= 760, hasTouch: width <= 760, colorScheme: locale === 'zh-CN' ? 'dark' : 'light', timezoneId: 'Asia/Shanghai' })
      await context.addInitScript(locale => {
        localStorage.setItem('v2rayn-web-token', 'isolated-application-fixture')
        localStorage.setItem('v2rayn-web-locale', locale)
        window.EventSource = class { addEventListener() {} close() {} }
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.__copied = value }, readText: async () => '[{"remarks":"Imported fixture","domain":["example.invalid"],"outboundTag":"direct"}]' } })
      }, locale)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      const fixture = applicationFixtures()
      await page.route('**/api/**', route => route.fulfill({ json: { success: true, data: fixture[new URL(route.request().url()).pathname] ?? [] } }))
      const labels = JSON.parse(await readFile(new URL(`../../Src/Locales/${locale}.json`, import.meta.url), 'utf8'))
      const saveSizes = []
      await page.goto(base)
      await page.locator('[data-profile-id="C"]').waitFor()
      async function navigate(id) {
        const index = ids.indexOf(id)
        if (width <= 760 && index >= 3) {
          await page.locator('.mobile-nav-more .action-menu-trigger').click()
          await page.locator('.mobile-nav-more .action-menu-item').nth(index - 3).click()
        } else await page.locator('.main-nav > .nav-tab').nth(index).click()
        if (id === 'subscriptions') await page.locator('[data-subscription-id="long"]').waitFor()
        if (id === 'routing') await page.locator('.rule-row').first().waitFor()
        if (id === 'dns') await page.waitForFunction(() => document.querySelector('.dns-page input')?.value === 'https://dns.example.invalid/dns-query')
        if (id === 'settings') await page.waitForFunction(() => document.querySelector('.settings-page input')?.value === '1145')
        if (id === 'templates') await page.locator('.template-editor').waitFor()
        if (id === 'maintenance') await page.waitForFunction(() => document.querySelectorAll('.maintenance-page .update-section').length >= 3)
        if (id === 'logs') await page.locator('.log-table tbody tr').nth(7).waitFor()
      }
      async function screenshot(name) {
        if (output) await page.screenshot({ path: `${output}/${locale}-${width}-${name}.png` })
      }
      async function mutation(path, method, trigger) {
        const pending = page.waitForRequest(request => new URL(request.url()).pathname === path && request.method() === method)
        await trigger()
        requestsChecked++
        return (await pending).postDataJSON()
      }
      for (const id of ids) {
        await navigate(id)
        assert.ok(await page.evaluate(width => document.documentElement.scrollWidth <= width, width), `${locale} ${width} ${id}: page overflow`)
        if (width <= 760) {
          for (const columns of await page.locator('.workspace .form-grid').evaluateAll(items => items.map(el => getComputedStyle(el).gridTemplateColumns))) assert.equal(columns.split(' ').length, 1, 'form fields remain single-column')
          if (id === 'subscriptions') {
            for (const key of ['local', 'network']) assert.ok((await page.locator(`[data-subscription-id="${key}"]`).boundingBox()).height < 180, 'subscription summary is compact')
            const card = page.locator('[data-subscription-id="network"]')
            assert.equal(await card.locator('.url-cell').isVisible(), false, 'URL is secondary and not exposed by default')
            await card.locator('.subscription-disclosure').click()
            assert.ok(await card.locator('.url-cell').isVisible())
            for (const empty of await card.locator('.empty-detail').all()) assert.equal(await empty.isVisible(), false)
            await screenshot('subscription-details')
            await card.locator('.subscription-disclosure').click()
            await page.evaluate(() => scrollTo(0, 0))
          }
          if (id === 'routing') {
            assert.equal(await page.locator('.rule-toolbar').isVisible(), false)
            assert.equal(await page.locator('.rule-import-options').isVisible(), false)
            assert.ok((await page.locator('.rule-row').first().boundingBox()).height < 115, 'rule summary is a compact list item')
            assert.equal(await page.locator('.rules-mini-table .rule-grid-head').isVisible(), false)
            await page.locator('.rules-panel').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 80))
            await screenshot('rules-list')
            await page.evaluate(() => scrollTo(0, 0))
          }
          if (['dns', 'settings', 'templates'].includes(id)) {
            const bar = page.locator('.save-bar')
            const bounds = await bar.boundingBox()
            assert.ok(bounds.height <= 64, 'save strip is not a large hint box')
            const field = page.locator(id === 'templates' ? '.template-code' : id === 'dns' ? '.dns-page .form-grid input' : '.settings-page .form-grid input').first()
            const fieldBounds = await field.boundingBox()
            assert.ok(Math.abs(bounds.x - fieldBounds.x) < 1 && Math.abs(bounds.width - fieldBounds.width) < 1, 'save strip aligns with form fields, not viewport compensation margins')
            assert.equal(await bar.locator('.save-bar-hint').count() ? await bar.locator('.save-bar-hint').isVisible() : false, false)
            const button = await bar.locator('button').boundingBox()
            saveSizes.push([button.width, button.height])
            await bar.scrollIntoViewIfNeeded()
            assert.ok((await bar.boundingBox()).y + (await bar.boundingBox()).height <= (await page.locator('.main-nav').boundingBox()).y + 1, 'save control stays above navigation')
            await screenshot(`${id}-save`)
            await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
            const bottomBounds = await bar.boundingBox()
            assert.ok(Math.abs(bottomBounds.x - fieldBounds.x) < 1 && Math.abs(bottomBounds.width - fieldBounds.width) < 1, 'save strip stays aligned at the bottom of long forms')
            await screenshot(`${id}-save-bottom`)
            await page.evaluate(() => scrollTo(0, 0))
          }
          if (id === 'logs') {
            assert.equal(await page.locator('.desktop-log-actions').isVisible(), false)
            assert.ok(await page.locator('.mobile-log-menu').isVisible())
            assert.ok(await page.locator('.log-table').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'log feed does not need horizontal scrolling')
          }
          if (id === 'maintenance') assert.equal(await page.locator('.desktop-update-actions').isVisible(), false)
        }
        await screenshot(id)
        metrics.push({ locale, width, page: id, height: await page.locator('.workspace .page').evaluate(el => el.getBoundingClientRect().height) })
        if (id === 'dns' || id === 'settings' || id === 'templates' || id === 'maintenance') {
          const tabs = page.locator('.section-tabs button')
          for (let i = 1; i < await tabs.count(); i++) {
            await tabs.nth(i).click()
            assert.ok(await page.evaluate(width => document.documentElement.scrollWidth <= width, width))
            await screenshot(`${id}-tab-${i}`)
          }
        }
      }
      if (width <= 760) assert.deepEqual(saveSizes, [[128, 44], [128, 44], [128, 44]], 'save buttons use one visual size across forms')
      if ([390, 502, 1440].includes(width) && locale === 'zh-CN') {
        await navigate('settings')
        await mutation('/api/settings/apply', 'PUT', () => page.locator('.save-bar button').click())
        await navigate('dns')
        await mutation('/api/settings/dns/simple', 'PUT', () => page.locator('.save-bar button').click())
        await navigate('templates')
        await mutation('/api/settings/core-templates/Xray', 'PUT', () => page.locator('.save-bar button').click())
        await navigate('subscriptions')
        const card = page.locator('[data-subscription-id="network"]')
        const actionRoot = width <= 760 ? card.locator('.mobile-subscription-actions') : card.locator('.desktop-subscription-actions')
        await mutation('/api/subscriptions/network/update', 'POST', () => actionRoot.getByRole('button', { name: labels.subscriptions.update, exact: true }).click())
        if (width <= 760) {
          await card.locator('.action-menu-trigger').click()
          await card.getByRole('menuitem', { name: labels.common.edit, exact: true }).click()
          await page.locator('.modal-panel').waitFor()
          await page.keyboard.press('Escape')
          await card.locator('.action-menu-trigger').click()
          await card.getByRole('menuitem', { name: labels.subscriptions.share, exact: true }).click()
          await page.waitForFunction(() => window.__copied === 'https://share.example.invalid/fixture')
          await card.locator('.action-menu-trigger').click()
          await card.getByRole('menuitem', { name: labels.common.delete, exact: true }).click()
          await page.locator('.confirm-panel').waitFor()
          await page.keyboard.press('Escape')
          await page.locator('.mobile-subscription-tools .action-menu-trigger').click()
          const subscriptionTools = page.locator('.mobile-subscription-tools')
          await subscriptionTools.getByRole('menuitemcheckbox').click()
          const bulk = await mutation('/api/subscriptions/update', 'POST', () => subscriptionTools.getByRole('menuitem', { name: labels.subscriptions.updateAllViaProxy, exact: true }).click())
          assert.deepEqual(bulk, { subscriptionId: null, useProxy: true })
          await mutation('/api/subscriptions/network/update', 'POST', () => card.getByRole('button', { name: labels.subscriptions.updateViaProxy, exact: true }).click())
          await navigate('routing')
          const menus = page.locator('.mobile-rule-actions .action-dropdown')
          await menus.first().locator('.action-menu-trigger').click()
          await menus.first().getByRole('menuitem', { name: labels.common.selectAll, exact: true }).click()
          assert.equal(await page.locator('.rule-row.selected').count(), 8)
          await menus.nth(1).locator('.action-menu-trigger').click()
          await menus.nth(1).getByRole('menuitemcheckbox').click()
          const content = '[{"remarks":"File fixture","domain":["example.invalid"],"outboundTag":"direct"}]'
          const data = await mutation('/api/settings/routing-profiles/route/rules/import', 'POST', () => page.locator('.mobile-rule-actions input[type="file"]').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(content) }))
          assert.deepEqual(data, { content, append: false })
          await page.keyboard.press('Escape')
          await page.locator('.rule-row .mobile-rule-menu .action-menu-trigger').first().click()
          await page.locator('.rule-row .mobile-rule-menu').first().getByRole('menuitem', { name: labels.common.edit, exact: true }).click()
          await page.locator('.modal-panel').waitFor()
          await page.keyboard.press('Escape')
          await navigate('maintenance')
          await page.locator('.section-tabs button').nth(1).click()
          const davBar = await page.locator('.mobile-webdav-actions .save-bar').boundingBox()
          const davField = await page.locator('.backup-section .form-grid input').first().boundingBox()
          assert.ok(Math.abs(davBar.x - davField.x) < 1 && Math.abs(davBar.width - davField.width) < 1, 'WebDAV save strip follows its fields too')
          await mutation('/api/settings/webdav', 'PUT', () => page.locator('.mobile-webdav-actions .save-bar > button').click())
          await page.locator('.mobile-webdav-actions .action-menu-trigger').click()
          await mutation('/api/backup/webdav/check', 'POST', () => page.locator('.mobile-webdav-actions').getByRole('menuitem', { name: labels.maintenance.checkWebdav, exact: true }).click())
          await navigate('logs')
          await page.locator('.mobile-log-menu .action-menu-trigger').click()
          await page.locator('.mobile-log-menu').getByRole('menuitem', { name: labels.logs.copyPage, exact: true }).click()
          await page.waitForFunction(() => window.__copied.includes('accepted tcp:node.example.invalid'))
        }
      }
      assert.deepEqual(errors, [], 'no browser errors across all eight pages')
      await context.close()
    }
  }
} finally { await browser.close() }
if (output) await writeFile(`${output}/metrics.json`, JSON.stringify(metrics, null, 2))
console.log(`All-page browser regression: ${metrics.length} page/viewport/locale combinations and ${requestsChecked} mocked save/update/import payloads passed.`)
