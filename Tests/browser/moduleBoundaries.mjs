// Presentation extraction regression. API fixtures isolate every mutation from real Backends.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { applicationFixtures } from './applicationFixtures.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const labels = JSON.parse(await readFile(new URL('../../Src/Locales/en-US.json', import.meta.url), 'utf8'))
const browser = await chromium.launch()
const base = process.env.WEBUI_URL || 'http://127.0.0.1:5178'
let mutationsChecked = 0
try {
  for (const width of [390, 1440]) {
    const mobile = width <= 760
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addInitScript(() => {
      localStorage.setItem('v2rayn-api-session:' + encodeURIComponent(location.origin), 'isolated-module-fixture')
      localStorage.setItem('v2rayn-web-locale', 'en-US')
      window.EventSource = class { addEventListener() {} close() {} }
    })
    const page = await context.newPage()
    const errors = []
    const mutations = []
    page.on('pageerror', error => errors.push(error.message))
    const fixture = applicationFixtures()
    Object.assign(fixture['/api/editor-options'].profiles, {
      configTypes: ['VMess', 'VLESS', 'PolicyGroup'], networks: ['raw', 'ws'],
      streamSecurityTypes: ['', 'tls', 'reality'], defaultStreamSecurity: '', defaultSecurity: 'auto',
      rawHeaderTypes: ['none', 'http'], flows: ['', 'xtls-rprx-vision'], alpns: ['', 'h2'], fingerprints: ['', 'chrome'],
      multipleLoadStrategies: ['LeastPing'],
    })
    fixture['/api/profiles/B'] = {
      ...fixture['/api/profiles'][1], coreType: 'Xray', password: 'fixture-uuid', allowInsecure: 'false',
      sni: '', alpn: '', fingerprint: '', publicKey: '', shortId: '',
      protoExtra: '{}', transportExtra: '{"rawHeaderType":"none"}',
    }
    await page.route('**/api/**', route => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() !== 'GET') mutations.push({ path, method: request.method(), body: request.postData() ? request.postDataJSON() : null })
      if (path.startsWith('/api/core/')) {
        fixture['/api/status'].coreRunning = !path.endsWith('/stop')
        fixture['/api/status'].runtimeState = path.endsWith('/stop') ? 'stopped' : 'running'
      }
      return route.fulfill({ json: { success: true, data: fixture[path] ?? [] } })
    })
    await page.goto(base)
    const row = page.locator('[data-profile-id="B"]')
    await row.waitFor()
    await row.locator('.remark-cell').click()
    await page.keyboard.press('e')
    const dialog = page.locator('.modal-panel')
    await dialog.waitFor()
    // UiDialog must preserve focus trapping, and forward the native form submit once.
    const firstFocusable = dialog.locator('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)').first()
    const save = dialog.getByRole('button', { name: labels.common.save, exact: true })
    await save.focus()
    await page.keyboard.press('Tab')
    assert.ok(await firstFocusable.evaluate(element => document.activeElement === element))
    await page.keyboard.press('Shift+Tab')
    assert.ok(await save.evaluate(element => document.activeElement === element))

    // Native labels enclosing selects include their option text in Playwright's label text.
    const field = key => dialog.getByLabel(labels.nodes[key]).first()
    await field('remarks').fill('')
    const beforeInvalid = mutations.filter(item => item.path === '/api/profiles/B').length
    await save.click()
    assert.equal(await dialog.evaluate(form => form.checkValidity()), false)
    assert.equal(mutations.filter(item => item.path === '/api/profiles/B').length, beforeInvalid)
    await field('remarks').fill('Edited fixture')
    await field('network').selectOption('ws')
    await field('host').fill('transport.example.invalid')
    await field('path').fill('/shared-state')
    await field('publicKey').fill('fixture-public-key')
    await field('shortId').fill('abcd')
    await field('sni').fill('tls.example.invalid')
    await field('allowInsecure').check()
    const editedRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/profiles/B' && request.method() === 'PUT')
    await save.click()
    const edited = (await editedRequest).postDataJSON()
    assert.equal(edited.remarks, 'Edited fixture')
    assert.equal(edited.network, 'ws')
    assert.equal(edited.publicKey, 'fixture-public-key')
    assert.equal(edited.shortId, 'abcd')
    assert.equal(edited.sni, 'tls.example.invalid')
    assert.equal(edited.allowInsecure, 'true')
    assert.equal(JSON.parse(edited.transportExtra).host, 'transport.example.invalid')
    assert.equal(JSON.parse(edited.transportExtra).path, '/shared-state')
    await dialog.waitFor({ state: 'detached' })
    assert.equal(mutations.filter(item => item.path === '/api/profiles/B').length, 1)
    mutationsChecked++

    await page.locator('.nodes-page-toolbar .action-menu-trigger').filter({ hasText: labels.nodes.addMenu }).click()
    await page.getByRole('menuitem', { name: labels.nodes.addNode, exact: true }).click()
    await dialog.waitFor()
    await field('type').selectOption('PolicyGroup')
    await field('remarks').fill('Group fixture')
    await dialog.locator('.group-profile-choice').filter({ hasText: ' B' }).locator('input').check()
    await dialog.locator('.group-profile-choice').filter({ hasText: ' C' }).locator('input').check()
    await dialog.locator('.group-member-row').first().getByRole('button', { name: labels.nodes.moveMemberDown, exact: true }).click()
    const groupRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/profiles' && request.method() === 'POST')
    await save.click()
    const group = (await groupRequest).postDataJSON()
    assert.equal(group.configType, 'PolicyGroup')
    assert.equal(JSON.parse(group.protoExtra).childItems, 'C,B')
    assert.equal('password' in group, false)
    assert.equal('transportExtra' in group, false)
    await dialog.waitFor({ state: 'detached' })
    mutationsChecked++

    // The Shell mounts runtime controls once; each click retains its original request path.
    if (mobile) {
      await page.locator('.header-more').click()
      await page.locator('.mobile-core-entry').click()
    }
    for (const [action, key] of [['stop', 'stop'], ['start', 'start'], ['restart', 'restart']]) {
      const request = page.waitForRequest(request => new URL(request.url()).pathname === `/api/core/${action}` && request.method() === 'POST')
      await page.locator('.core-actions').getByRole('button', { name: labels.nodes[key], exact: true }).click()
      await request
      assert.equal(mutations.filter(item => item.path === `/api/core/${action}`).length, 1)
      mutationsChecked++
    }
    if (mobile) await page.keyboard.press('Escape')
    await page.locator('.main-nav > .nav-tab').nth(1).click()
    await page.locator('.subscriptions-page .page-header .button.primary').click()
    await dialog.waitFor()
    await dialog.getByLabel(labels.subscriptions.name, { exact: true }).fill('Subscription fixture')
    const subscriptionRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/subscriptions' && request.method() === 'POST')
    await save.click()
    const subscription = (await subscriptionRequest).postDataJSON()
    assert.equal(subscription.remarks, 'Subscription fixture')
    assert.equal(subscription.url, '')
    await dialog.waitFor({ state: 'detached' })
    assert.equal(mutations.filter(item => item.path.includes('subscriptions') && item.path.endsWith('/update')).length, 0)
    assert.equal(mutations.filter(item => item.path === '/api/subscriptions' && item.method === 'POST').length, 1)
    mutationsChecked++

    // The extracted Session screen still writes the original credential draft and submits once.
    fixture['/api/auth/login'] = { token: 'isolated-restored-session' }
    if (mobile) await page.locator('.header-more').click()
    const logoutRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/auth/logout' && request.method() === 'POST')
    await page.locator('.header-right').getByRole('button', { name: labels.auth.disconnect, exact: true }).click()
    await logoutRequest
    await page.locator('#management-key').waitFor()
    assert.equal(await page.locator('.workspace').count(), 0)
    await page.locator('#management-key').fill('ui-only-management-key')
    const loginRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/auth/login' && request.method() === 'POST')
    await page.locator('.auth-box').getByRole('button', { name: labels.auth.connect, exact: true }).click()
    assert.deepEqual((await loginRequest).postDataJSON(), { key: 'ui-only-management-key' })
    await page.locator('[data-profile-id="C"]').waitFor()
    assert.equal(mutations.filter(item => item.path === '/api/auth/login').length, 1)
    assert.equal(await page.evaluate(() => Object.values(localStorage).some(value => value.includes('ui-only-management-key'))), false)
    mutationsChecked += 2
    assert.deepEqual(errors, [])
    await context.close()
  }
} finally { await browser.close() }
console.log(`Module-boundary browser regression: ${mutationsChecked} desktop/mobile editor, subscription, Core and Session requests plus validation/focus checks passed.`)
