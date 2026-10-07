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

test('mobile Core controls are progressively disclosed from the App Bar without duplicating desktop logic', async () => {
  const [app, header, status, panel, css] = await Promise.all([
    source('App.vue'), source('Components/AppHeader.vue'), source('Components/CoreStatus.vue'), source('Components/CorePanel.vue'), source('style.css'),
  ])
  assert.match(app, /<CoreStatus[^>]*:open="showCorePanel" @close="showCorePanel = false"/)
  assert.match(app, /showCorePanel\.value = false/)
  assert.match(header, /class="button mobile-core-entry" @click="openCorePanel"/)
  assert.match(status, /v-if="mobile" class="mobile-core-summary" role="status"/)
  assert.match(status, /v-if="!mobile \|\| open" :is="mobile \? CorePanel : 'div'"/)
  assert.equal((status.match(/<RuntimeStrip /g) || []).length, 1)
  assert.equal((status.match(/<ConnectionStrip /g) || []).length, 1)
  assert.match(status, /if \(!mobile\.value\) emit\('close'\)/)
  assert.match(status, /query\.removeEventListener\('change', updateViewport\)/)
  assert.match(panel, /useModalFocus\(panel\)/)
  assert.match(panel, /role="dialog" aria-modal="true"/)
  assert.match(panel, /@click\.self="emit\('close'\)"/)
  assert.match(css, /\.core-status-host \{ display: contents/)
  assert.match(css, /\.button\.mobile-core-entry \{ display: none/)
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
  assert.match(css, /\.rule-row > \.rule-details \{ display: block/)
  assert.match(css, /\.mobile-rule-outbound \{ display: inline-block/)
})

test('mobile subscription cards disclose optional fields and keep existing actions in a compact footer', async () => {
  const [page, css] = await Promise.all([source('Components/Pages/SubscriptionsPage.vue'), source('style.css')])
  assert.match(page, /:aria-expanded="expanded\.has\(item\.id\)"/)
  for (const action of ['updateSubscription(item.id)', 'openEditSubscription(item)', 'shareSubscription(item)', 'deleteSubscription(item)']) assert.ok(page.includes(action))
  assert.match(css, /\.subscription-table tr:not\(\.details-open\) > \.subscription-detail/)
  assert.match(css, /\.mobile-subscription-status \{ display: inline-flex/)
})

test('routing uses batch/import menus and row context actions on mobile without losing matchers', async () => {
  const [page, css] = await Promise.all([source('Components/Pages/RoutingPage.vue'), source('style.css')])
  assert.match(page, /class="mobile-rule-actions"/)
  assert.match(page, /\['top', 'up', 'down', 'bottom'\]/)
  assert.match(page, /role="menuitemcheckbox" :aria-checked="state\.appendRules"/)
  assert.match(page, /class="mobile-rule-menu"[^>]*icon-only/)
  assert.match(css, /\.rule-toolbar, \.rule-import-options \{ display: none/)
  assert.match(css, /\.rule-row > \.rule-details \{ display: block/)
})

test('settings, DNS and templates share a save bar with one click/submit path and no duplicate mobile hint', async () => {
  const [settings, dns, templates, bar, css] = await Promise.all([
    source('Components/Pages/SettingsPage.vue'), source('Components/Pages/DnsPage.vue'), source('Components/Pages/TemplatesPage.vue'), source('Components/SaveBar.vue'), source('style.css'),
  ])
  assert.match(settings, /<SaveBar sticky[^>]*@save="actions\.saveAllSettings"/)
  assert.match(dns, /<SaveBar @save="actions\.saveSimpleDns"/)
  assert.match(dns, /<SaveBar @save="actions\.saveDnsProfile\(activeDnsProfile\)"/)
  assert.match(templates, /<SaveBar submit/)
  assert.match(bar, /:type="submit \? 'submit' : 'button'"/)
  assert.match(css, /\.save-bar > \.save-bar-hint \{ display: none/)
  assert.match(css, /\.save-bar > \.button \{ min-width: 128px; min-height: 44px/)
  assert.match(css, /\.save-bar \{[^}]*width: 100%; min-width: 0/)
  assert.doesNotMatch(css, /\.template-editor \.save-bar \{ margin-inline: -/)
  assert.doesNotMatch(css, /\.save-bar[^}]*margin(?:-inline)?:[^;]*-16px/)
})

test('mobile nodes use a compact identity-first summary with selectable, expandable secondary data', async () => {
  const [page, css] = await Promise.all([source('Components/Pages/NodesPage.vue'), source('style.css')])
  assert.match(page, /expandedProfiles = ref\(new Set<string>\(\)\)/)
  assert.match(page, /:aria-expanded="expandedProfiles\.has\(profile\.indexId\)" @click\.stop="toggleDetails\(profile\.indexId\)"/)
  assert.match(page, /class="node-select-label" @click\.stop @dblclick\.stop/)
  assert.match(page, /class="mobile-node-port">:\{\{ profile\.port \}\}/)
  for (const field of ['todayUp', 'todayDown', 'totalUp', 'totalDown']) assert.ok(page.includes(`actions.formatBytes(profile.${field})`))
  assert.match(css, /\.profile-table td\.remark-cell \{ grid-column: 1 \/ -1; grid-row: 1/)
  assert.match(css, /\.profile-table td\.node-metric \{ grid-row: 3; grid-column: span 2/)
  assert.match(css, /\.profile-table td\.mobile-node-details \{ display: flex; grid-row: 3; grid-column: 5 \/ -1/)
  assert.match(css, /\.profile-table tr:not\(\.details-open\) > \.node-detail-cell \{ display: none/)
  assert.match(css, /\.mobile-node-port, \.mobile-node-type, \.mobile-node-transport, \.profile-table td\.mobile-node-details \{ display: none/)
})

test('mobile protocol type is an intrinsic-width capsule, not a full-width button-like row', async () => {
  const [page, css] = await Promise.all([source('Components/Pages/NodesPage.vue'), source('style.css')])
  assert.match(page, /class="remark-cell"[^\n]*class="mobile-node-type"/)
  assert.match(page, /class="node-endpoint-value"[^\n]*class="mobile-node-transport"/)
  assert.match(css, /\.mobile-node-type \{ display: inline-flex; flex: 0 0 auto;[^}]*border-radius: 999px/)
  assert.match(css, /\.profile-table td\.node-badge \{ display: none/)
  assert.match(css, /\.node-endpoint-value \{ flex: 1 1 170px; min-width: 0; overflow-wrap: anywhere/)
})

test('mobile node utilities stay reachable through Tools before Add, rather than a loose icon row', async () => {
  const [page, css] = await Promise.all([source('Components/Pages/NodesPage.vue'), source('style.css')])
  assert.ok(page.indexOf('class="mobile-node-tools"') < page.indexOf(':label="t(\'nodes.addMenu\')"'))
  const tools = page.slice(page.indexOf('class="mobile-node-tools"'), page.indexOf(':label="t(\'nodes.addMenu\')"'))
  for (const action of ['openEditSubscription(selectedSubscription)', 'openAddSubscription', "startSpeedTest('fastRealping')", "startSpeedTest('mixedtest')"]) assert.ok(tools.includes(action))
  assert.match(tools, /role="menuitemcheckbox" :aria-checked="autoFitColumns"/)
  assert.match(css, /\.mobile-node-tools \{ display: none/)
  assert.match(css, /\.nodes-page-toolbar \.mobile-node-tools \{ display: block/)
  assert.match(css, /\.nodes-page \.group-toolbar \.node-toolbar-action \{ display: none !important/)
})
