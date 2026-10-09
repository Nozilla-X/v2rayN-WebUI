// Computed-style and interaction checks; no real Backend is contacted.
import assert from 'node:assert/strict'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch()
const ids = ['nodes', 'subscriptions', 'routing', 'dns', 'settings', 'templates', 'maintenance', 'logs']
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
let checked = 0

try {
  for (const width of [320, 390, 760, 761, 1280, 1920]) {
    for (const theme of ['dark', 'light']) {
      const mobile = width <= 760
      const height = mobile ? 44 : 32
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
      await context.addInitScript(theme => {
        localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-design-fixture')
        localStorage.setItem('v2rayn-web-locale', 'en-US')
        localStorage.setItem('v2rayn-web-theme', theme)
        window.EventSource = class { addEventListener() {} close() {} }
      }, theme)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let failSave = false
      const fixture = applicationFixtures()
      await page.route('**/api/**', route => {
        if (failSave && route.request().method() === 'PUT') return route.fulfill({ status: 500, json: { success: false, code: 'isolated-save-error' } })
        return route.fulfill({ json: { success: true, data: fixture[new URL(route.request().url()).pathname] ?? [] } })
      })
      await page.goto(base)
      await page.locator('[data-profile-id="C"]').waitFor()
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      async function navigate(id) {
        const index = ids.indexOf(id)
        if (mobile && index >= 3) {
          await page.locator('.mobile-nav-more .action-menu-trigger').click()
          await page.locator('.mobile-nav-more .action-menu-item').nth(index - 3).click()
        } else await page.locator('.main-nav > .nav-tab').nth(index).click()
        await page.locator(`.${id}-page`).waitFor()
      }
      for (const id of ids) {
        await navigate(id)
        if (id === 'dns') await page.waitForFunction(() => document.querySelector('.dns-page input')?.value === 'https://dns.example.invalid/dns-query')
        if (id === 'settings') await page.waitForFunction(() => document.querySelector('.settings-page input')?.value === '1145')
        if (id === 'templates') await page.locator('.template-editor').waitFor()
        if (id === 'maintenance') await page.waitForFunction(() => document.querySelectorAll('.update-section').length >= 3)
        if (id === 'logs') await page.locator('.log-table tbody tr').nth(7).waitFor()
        const metrics = await page.evaluate(() => {
          const visible = element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden'
          const styles = selector => [...document.querySelectorAll(selector)].filter(visible).map(element => {
            const style = getComputedStyle(element)
            return { height: element.getBoundingClientRect().height, minHeight: style.minHeight, font: style.fontSize, radius: style.borderRadius }
          })
          return {
            overflow: document.documentElement.scrollWidth > innerWidth,
            workspace: document.querySelector('.workspace').getBoundingClientRect().width,
            padding: getComputedStyle(document.querySelector('.workspace')).paddingLeft,
            heading: styles('.page h1'), sections: styles('.page h2'),
            buttons: styles('.page .button, .page .tool-button, .page .link-button'),
            fields: styles('.page input:not([type="checkbox"]):not([type="file"]):not(.search-box input), .page select'),
            searches: styles('.page .search-box'),
          }
        })
        assert.equal(metrics.overflow, false, `${width} ${theme} ${id}: no viewport overflow`)
        assert.equal(metrics.workspace, Math.min(width, 1880))
        assert.equal(metrics.padding, mobile ? '12px' : '16px')
        assert.equal(metrics.heading[0].font, '18px')
        for (const section of metrics.sections) assert.equal(section.font, '14px', `${id}: section heading`)
        for (const button of metrics.buttons) {
          assert.equal(button.minHeight, `${height}px`, `${id}: button scale`)
          assert.equal(button.radius, '6px', `${id}: button radius`)
        }
        for (const field of metrics.fields) {
          assert.ok(field.height >= height, `${id}: input height`)
          assert.equal(field.font, mobile ? '16px' : '13px', `${id}: input typography`)
          assert.equal(field.radius, '6px', `${id}: input radius`)
        }
        for (const search of metrics.searches) {
          assert.ok(search.height >= height)
          assert.equal(search.radius, '6px')
        }
        checked++
      }

      await navigate('nodes')
      const selected = page.locator('[data-profile-id="B"]')
      await selected.locator('input[type="checkbox"]').check()
      const selectedColor = await selected.evaluate(element => getComputedStyle(element).backgroundColor)
      await selected.hover()
      assert.equal(await selected.evaluate(element => getComputedStyle(element).backgroundColor), selectedColor, 'hover preserves selected state')

      await navigate('subscriptions')
      const create = page.locator('.page-header .button.primary')
      await page.keyboard.press('Tab')
      await create.focus()
      assert.equal(await create.evaluate(element => getComputedStyle(element).outlineWidth), '2px', 'keyboard focus is visible')
      const disabled = page.locator(mobile ? '.mobile-subscription-tools .action-menu-item:disabled' : '.desktop-subscription-tools .button:disabled')
      if (mobile) await page.locator('.mobile-subscription-tools .action-menu-trigger').click()
      assert.equal(await disabled.evaluate(element => getComputedStyle(element).opacity), '0.45')
      if (mobile) await page.keyboard.press('Escape')
      await create.click()
      const dialog = page.locator('.modal-panel')
      await dialog.waitFor()
      const dialogLimit = (await dialog.getAttribute('class')).includes('wide-modal') ? 850 : 540
      assert.ok((await dialog.boundingBox()).width <= (mobile ? width : Math.min(width - 24, dialogLimit)))
      assert.equal(await dialog.evaluate(element => getComputedStyle(element).borderRadius), mobile ? '0px' : '8px')
      const dialogField = dialog.locator('input:not([type="checkbox"])').first()
      assert.ok((await dialogField.boundingBox()).height >= height)
      await page.keyboard.press('Escape')
      assert.equal(await dialog.count(), 0)

      await navigate('settings')
      failSave = true
      await page.locator('.save-bar > button').click()
      const error = page.locator('.toast-error').last()
      await error.waitFor()
      assert.equal(await error.evaluate(element => getComputedStyle(element).borderRadius), '8px')
      await error.locator('.toast-close').click()
      failSave = false
      await page.locator('.save-bar > button').click()
      await page.locator('.toast-success').last().waitFor()

      fixture['/api/subscriptions'] = []
      await page.reload()
      await page.locator('[data-profile-id="C"]').waitFor()
      await navigate('subscriptions')
      await page.locator('.empty-row').waitFor()
      assert.ok((await page.locator('.empty-row').boundingBox()).height >= 80)
      assert.deepEqual(errors, [], `${width} ${theme}: no browser errors`)
      await context.close()
    }
  }
} finally { await browser.close() }
console.log(`Design-system browser regression: ${checked} page/viewport/theme combinations plus focus, disabled, selected, dialog, Toast and empty states passed.`)
