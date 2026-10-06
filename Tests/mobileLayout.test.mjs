import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const source = (path) => readFile(new URL(`../Src/${path}`, import.meta.url), 'utf8')

test('mobile global controls reuse one set of controls behind an accessible dismissible entry', async () => {
  const header = await source('Components/AppHeader.vue')
  assert.equal((header.match(/class="locale-select"/g) || []).length, 1)
  assert.equal((header.match(/class="theme-select"/g) || []).length, 1)
  assert.match(header, /:aria-expanded="controlsOpen" aria-controls="global-controls"/)
  assert.match(header, /document\.addEventListener\('pointerdown', closeControls\)/)
  assert.match(header, /document\.removeEventListener\('pointerdown', closeControls\)/)
  assert.match(header, /event\.key === 'Escape'/)
  assert.match(header, /desktop\.removeEventListener\('change', syncControls\)/)
})

test('mobile navigation exposes common destinations and keeps every other destination in More', async () => {
  const [header, css] = await Promise.all([source('Components/AppHeader.vue'), source('style.css')])
  assert.match(header, /'secondary-nav': Number\(index\) > 2/)
  assert.match(header, /v-for="item in state\.navItems\.slice\(3\)"/)
  assert.match(header, /:aria-current="state\.activePage === item\.id \? 'page' : undefined"/)
  assert.match(css, /\.main-nav \{ position: fixed;[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(css, /\.app-shell:has\(\.main-nav\)[^}]*safe-area-inset-bottom/)
  assert.match(css, /\.settings-global-footer \{ bottom: calc\(64px \+ env\(safe-area-inset-bottom\)\)/)
})

test('runtime retains all operations while mobile promotes the applicable primary operation', async () => {
  const [runtime, css] = await Promise.all([source('Components/RuntimeStrip.vue'), source('style.css')])
  for (const action of ['start', 'restart', 'stop']) assert.match(runtime, new RegExp(`actions\\.coreAction\\('${action}'\\)`))
  for (const group of ['runtime-health', 'runtime-node', 'runtime-route']) assert.ok(runtime.includes(`class="${group}"`))
  assert.match(runtime, /label for="runtime-route"/)
  assert.match(css, /\.core-actions > \.primary \{ grid-column: 1 \/ -1/)
  assert.match(css, /\.core-actions\.core-running > :nth-child\(2\) \{ grid-column: 1 \/ -1; grid-row: 1/)
  assert.match(css, /\.current-runtime-name \{ max-width: none;[^}]*white-space: normal; overflow-wrap: anywhere/)
})

test('mobile status grids explicitly fill the cards even with short or empty content', async () => {
  const css = await source('style.css')
  for (const selector of ['runtime-strip', 'connection-strip']) {
    assert.match(css, new RegExp(`\\.${selector} \\{ display: grid; grid-template-columns: minmax\\(0, 1fr\\); justify-content: stretch; align-items: stretch`))
  }
  assert.match(css, /\.runtime-node, \.runtime-route \{ display: grid; grid-template-columns: 48px minmax\(0, 1fr\)/)
  assert.match(css, /\.traffic-list \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('mobile forms use one column and scrolling tabs keep touch targets without changing desktop grids', async () => {
  const css = await source('style.css')
  assert.match(css, /\.form-grid\.three-col \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/)
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.form-grid\.two-col, \.form-grid\.three-col \{ grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /:root \{ --control-height-touch: 44px/)
  assert.match(css, /\.settings-sniffing-row \{ grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /\.section-tabs \{[^}]*overflow-x: auto/)
  assert.match(css, /\.section-tabs button \{ min-height: 44px; padding: 0 16px/)
})

test('subscription and routing cards preserve all desktop data and row actions on mobile', async () => {
  const [subscriptions, routing, css] = await Promise.all([
    source('Components/Pages/SubscriptionsPage.vue'), source('Components/Pages/RoutingPage.vue'), source('style.css'),
  ])
  for (const key of ['name', 'url', 'interval', 'updated', 'userAgent', 'filter']) {
    assert.ok(subscriptions.includes(`:data-label="t('subscriptions.${key}')"`))
  }
  for (const key of ['ruleType', 'outboundTag', 'matchers']) assert.ok(routing.includes(`:data-label="t('routing.${key}')"`))
  assert.match(css, /\.subscription-table td \{[^}]*overflow-wrap: anywhere/)
  assert.match(css, /\.rule-row > :nth-child\(3\), \.rule-row > :nth-child\(4\), \.rule-row > :nth-child\(5\) \{ display: block/)
})
