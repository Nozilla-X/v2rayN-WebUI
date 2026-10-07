import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

function services() {
  return {
    t: (key) => key,
    showNotice() {},
    showError: (error) => { throw error },
    confirm: async () => true,
    operationMessage: () => 'saved',
    queryPath: (route, values) => {
      const query = new URLSearchParams(Object.entries(values).filter(([, value]) => value !== '' && value != null))
      return query.size ? `${route}?${query}` : route
    },
    canonicalCode: (value, codes) => codes.find((code) => code.toLowerCase() === String(value).toLowerCase()) || value,
    coreTypeRoute: (value) => value.toLowerCase() === 'xray' ? 'Xray' : value,
    loadStatus: async () => {}, loadOperations: async () => {},
    request: async () => ({ success: true }), data: async () => [],
  }
}

function createProfiles(harness, extra = {}) {
  const { useProfiles } = harness.loadSource('Src/Composables/useProfiles.ts')
  return useProfiles({ ...services(), busy: harness.vue.ref(false), operations: harness.vue.ref([]), contextMenu: harness.vue.ref(null), ...extra })
}

test('routing refresh exports an executable action that reloads the API data', async () => {
  const harness = createSourceHarness()
  const { useRouting } = harness.loadSource('Src/Composables/useRouting.ts')
  const requests = []
  const routing = useRouting({ ...services(), data: async (route) => { requests.push(route); return [] } })
  await routing.routingPageActions.loadRouting()
  assert.deepEqual(requests, ['/api/settings/routing-profiles'])
})

test('a slower profiles response cannot replace the newly selected group or filter', async () => {
  const harness = createSourceHarness()
  const pending = []
  const profiles = createProfiles(harness, { data: (route) => new Promise((resolve) => pending.push({ route, resolve })) })
  profiles.selectedGroup.value = 'A'
  const first = profiles.loadProfiles()
  profiles.selectedGroup.value = 'B'
  const second = profiles.loadProfiles()
  pending[1].resolve([{ indexId: 'node-B' }])
  await second
  pending[0].resolve([{ indexId: 'node-A' }])
  await first
  assert.equal(profiles.profiles.value[0].indexId, 'node-B')

  const beforeReset = profiles.loadProfiles()
  profiles.reset()
  pending[2].resolve([{ indexId: 'stale-node' }])
  await beforeReset
  assert.deepEqual(profiles.profiles.value, [])

  profiles.selectedGroup.value = 'B'
  profiles.nodesPageState.filter = 'old'
  const oldFilter = profiles.loadProfiles()
  profiles.nodesPageState.filter = 'new'
  const newFilter = profiles.loadProfiles()
  pending[4].resolve([{ indexId: 'new-filter-result' }])
  await newFilter
  pending[3].resolve([{ indexId: 'old-filter-result' }])
  await oldFilter
  assert.equal(profiles.profiles.value[0].indexId, 'new-filter-result')
})

test('node moves use the whole group rather than treating filtered rows as a boundary', async () => {
  const harness = createSourceHarness()
  const requests = []
  const profiles = createProfiles(harness, {
    data: async (route) => { requests.push(route); return ['A', 'B', 'C', 'D'].map((indexId) => ({ indexId })) },
    request: async (_route, init) => { requests.push(init.body.profileId); return {} },
  })
  profiles.profiles.value = [{ indexId: 'B' }, { indexId: 'C' }]
  profiles.selectedIds.value = ['B', 'C']
  profiles.nodesPageState.filter = 'B|C'
  await profiles.nodesPageActions.moveSelected('up')
  assert.equal(requests[0], '/api/profiles')
  assert.deepEqual(requests.slice(1, 3), ['B', 'C'])
})

test('canceling a pending node editor load cannot reopen a dialog with previously fetched credentials', async () => {
  const harness = createSourceHarness()
  let cancelCatalog
  let catalogStarted
  const catalogReady = new Promise((resolve) => { catalogStarted = resolve })
  const profiles = createProfiles(harness, {
    showError: (error) => assert.equal(error.name, 'AbortError'),
    data: async (route) => {
      if (route === '/api/editor-options') return { profiles: { configTypes: ['VMess'], coreTypes: ['Xray'], networks: ['raw'], defaultNetwork: 'raw' } }
      if (route === '/api/profiles/node-1') return { indexId: 'node-1', configType: 'VMess', password: 'test-private-password' }
      catalogStarted()
      return new Promise((_resolve, reject) => { cancelCatalog = () => reject(new DOMException('Canceled', 'AbortError')) })
    },
  })
  const opening = profiles.openEditProfile({ indexId: 'node-1' })
  await catalogReady
  profiles.reset()
  cancelCatalog()
  await opening
  assert.equal(profiles.profileModalState.showProfileForm, false)
  assert.deepEqual(profiles.profileModalState.profileForm, {})
})

test('canceling subscription option loading cannot reopen a dialog with a private subscription URL', async () => {
  const harness = createSourceHarness()
  const { useSubscriptions } = harness.loadSource('Src/Composables/useSubscriptions.ts')
  let cancelCatalog
  let catalogStarted
  const catalogReady = new Promise((resolve) => { catalogStarted = resolve })
  const subscriptions = useSubscriptions({
    ...services(), locale: harness.vue.ref('zh-CN'), selectedGroup: harness.vue.ref(''), groups: harness.vue.ref([]), loadGroups: async () => {}, loadProfiles: async () => {},
    showError: (error) => assert.equal(error.name, 'AbortError'),
    data: async (route) => {
      if (route === '/api/editor-options') return { subscriptions: {} }
      catalogStarted()
      return new Promise((_resolve, reject) => { cancelCatalog = () => reject(new DOMException('Canceled', 'AbortError')) })
    },
  })
  const opening = subscriptions.subscriptionsPageActions.openEditSubscription({ id: 'sub-1', url: 'https://private.example' })
  await catalogReady
  subscriptions.reset()
  cancelCatalog()
  await opening
  assert.equal(subscriptions.subscriptionModalState.showSubscriptionForm, false)
  assert.deepEqual(subscriptions.subscriptionModalState.subscriptionForm, {})
})

test('routing rule save submits advanced JSON edits instead of the original form values', async () => {
  const harness = createSourceHarness()
  const { useRouting } = harness.loadSource('Src/Composables/useRouting.ts')
  let saved
  const routing = useRouting({
    ...services(), request: async (_route, init) => { saved = init.body; return {} }, data: async () => saved,
  })
  const rule = { id: 'R', enabled: true, outboundTag: 'proxy', domain: ['old.example'] }
  routing.selectedRoutingId.value = 'route-1'
  routing.routingPageState.routingRules = [rule]
  routing.routingPageActions.openEditRoutingRule(rule)
  routing.ruleModalState.ruleAdvancedJson = JSON.stringify({ ...rule, outboundTag: 'direct', domain: ['new.example'] })
  await routing.ruleModalActions.saveRoutingRule()
  assert.equal(saved[0].outboundTag, 'direct')
  assert.deepEqual(saved[0].domain, ['new.example'])
})

test('routing batch moves issue up requests forwards and down requests backwards', async () => {
  const harness = createSourceHarness()
  const { useRouting } = harness.loadSource('Src/Composables/useRouting.ts')
  for (const [direction, expected] of [['up', ['B', 'C']], ['down', ['C', 'B']]]) {
    const moved = []
    const routing = useRouting({
      ...services(), data: async () => ['A', 'B', 'C', 'D'].map((id) => ({ id })),
      request: async (_route, init) => { moved.push(init.body.ruleId); return {} },
    })
    routing.selectedRoutingId.value = 'route-1'
    routing.routingPageState.routingRules = ['A', 'B', 'C', 'D'].map((id) => ({ id }))
    routing.routingPageState.selectedRuleIds = ['B', 'C']
    await routing.routingPageActions.moveSelectedRules(direction)
    assert.deepEqual(moved, expected)
  }
})

test('web update checks save edited preferences before checking and retain them after reload', async () => {
  const harness = createSourceHarness()
  const { useMaintenance } = harness.loadSource('Src/Composables/useMaintenance.ts')
  const calls = []
  let persisted = { checkPreReleaseCoreTypes: [], preRelease: false, useProxy: true, targets: [], geoFilesSelected: true }
  const maintenance = useMaintenance({
    ...services(), translateKey: (key) => key, token: harness.vue.ref('test-session'), status: harness.vue.ref(null), operations: harness.vue.ref([]), loadProfiles: async () => {},
    data: async (route) => route === '/api/core-updates' ? structuredClone(persisted)
      : route.endsWith('progress') ? []
        : route === '/api/web-updates' ? { name: 'v2rayN.Web', selected: false }
          : {},
    request: async (route, init) => {
      calls.push(route)
      if (route === '/api/core-updates/settings') persisted = { ...persisted, ...init.body }
      return { data: { updateAvailable: false }, messageKey: 'up-to-date' }
    },
  })
  await maintenance.loadMaintenance()
  maintenance.maintenancePageActions.setPreReleaseTarget('v2rayN.Web', true)
  maintenance.updateSettings.value.useProxy = false
  await maintenance.maintenancePageActions.checkWebUpdate()
  assert.deepEqual(calls, ['/api/core-updates/settings', '/api/web-updates/check'])
  assert.equal(maintenance.updateSettings.value.preRelease, true)
  assert.deepEqual(maintenance.updateSettings.value.checkPreReleaseCoreTypes, ['v2rayN.Web'])
  assert.equal(maintenance.updateSettings.value.useProxy, false)
})

test('web update checks do not continue with stale preferences when saving fails', async () => {
  const harness = createSourceHarness()
  const { useMaintenance } = harness.loadSource('Src/Composables/useMaintenance.ts')
  const calls = []
  const maintenance = useMaintenance({
    ...services(), translateKey: (key) => key, token: harness.vue.ref('test-session'), status: harness.vue.ref(null), operations: harness.vue.ref([]), loadProfiles: async () => {},
    showError() {}, request: async (route) => { calls.push(route); throw new Error('Save failed') },
  })
  await maintenance.maintenancePageActions.checkWebUpdate()
  assert.deepEqual(calls, ['/api/core-updates/settings'])
})

test('non-JSON HTTP failures show the status and never use the success fallback', async (t) => {
  const harness = createSourceHarness()
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  const api = useApi({ getToken: () => '', onUnauthorized() {}, translateKey: (key) => key || 'operation completed' })
  for (const status of [400, 502, 503]) {
    globalThis.fetch = async () => new Response('<html>Error</html>', { status })
    await assert.rejects(api.request('/api/mock'), (error) => {
      assert.equal(error.status, status)
      assert.match(error.message, new RegExp(`HTTP ${status}`))
      assert.doesNotMatch(error.message, /operation completed/)
      return true
    })
  }
})

test('responses from a canceled or previous session cannot restore data or revoke the new session', async (t) => {
  const harness = createSourceHarness()
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  const originalFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = originalFetch })
  let resolve
  globalThis.fetch = () => new Promise((complete) => { resolve = complete })
  let token = 'old-session'
  let unauthorized = 0
  const api = useApi({ getToken: () => token, onUnauthorized: () => { unauthorized += 1 }, translateKey: (key) => key })
  const pending = api.request('/api/mock')
  api.cancelPendingRequests()
  token = 'new-session'
  resolve(Response.json({ success: false }, { status: 401 }))
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(unauthorized, 0)
})

test('blocked browser storage cannot prevent clearing auth or credential drafts', async (t) => {
  const harness = createSourceHarness()
  const { useSession } = harness.loadSource('Src/Composables/useSession.ts')
  const original = globalThis.localStorage
  globalThis.localStorage = { removeItem() { throw new Error('Storage blocked') } }
  t.after(() => {
    if (original === undefined) delete globalThis.localStorage
    else globalThis.localStorage = original
  })
  const token = harness.vue.ref('test-session')
  const authenticated = harness.vue.ref(true)
  let resets = 0
  const session = harness.setup(() => useSession({
    token, authenticated, loading: harness.vue.ref(false), request: async () => ({}),
    t: (key) => key, showNotice() {}, showError() {}, closeEvents() {}, openEvents() {},
    refreshData: async () => {}, loadConnectedData: async () => {}, loadProfiles: async () => {},
    resetSessionData: () => { resets += 1 },
  }))
  session.managementKeyDraft.value = 'test-management-key'
  session.setupKey.value = 'test-setup-key'
  session.setupConfirmKey.value = 'test-setup-key'
  session.clearSession()
  assert.equal(token.value, '')
  assert.equal(authenticated.value, false)
  assert.equal(session.managementKeyDraft.value, '')
  assert.equal(session.setupKey.value, '')
  assert.equal(session.setupConfirmKey.value, '')
  assert.equal(resets, 1)
  await harness.dispose()
})

test('restored sessions load editor options and a 401 clears every sensitive dialog and state', async (t) => {
  const harness = createSourceHarness()
  const original = Object.fromEntries(['localStorage', 'window', 'document', 'EventSource', 'fetch'].map((name) => [name, globalThis[name]]))
  const storage = new Map([['v2rayn-api-session:same-origin', 'test-session']])
  globalThis.localStorage = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
  globalThis.document = { documentElement: { dataset: {}, style: {} }, querySelector: () => null, addEventListener() {}, removeEventListener() {} }
  const eventSources = []
  globalThis.EventSource = class {
    constructor() { eventSources.push(this); this.closed = false }
    addEventListener() {} removeEventListener() {} close() { this.closed = true }
  }
  const requests = []
  let expired = false
  globalThis.fetch = async (route) => {
    requests.push(route)
    if (expired) return Response.json({ success: false, messageKey: 'errors.unauthorized' }, { status: 401 })
    let data = {}
    if (route === '/api/setup/status') data = { setupRequired: false }
    else if (route === '/api/profile-groups') data = [{ id: '', isCurrent: true }]
    else if (route.startsWith('/api/profiles') || ['/api/subscriptions', '/api/operations', '/api/settings/routing-profiles'].includes(route)) data = []
    else if (route === '/api/status') data = { runtimeState: 'stopped' }
    else if (route === '/api/settings') data = { coreTypes: [{ configType: 'vmess', coreType: 'xray' }], options: {} }
    else if (route.startsWith('/api/logs/page')) data = { items: [], total: 0, page: 1 }
    else if (route === '/api/auth/sse-ticket') data = { ticket: 'test-ticket' }
    else if (route === '/api/editor-options') data = { profiles: { coreTypes: ['Xray', 'sing_box'], configTypes: ['VMess'] } }
    return Response.json({ success: true, data })
  }
  let app
  t.after(async () => {
    if (app) { app.session.clearSession(); await harness.vue.nextTick() }
    await harness.dispose()
    for (const [name, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[name]
      else globalThis[name] = value
    }
  })
  const component = harness.loadSource('Src/App.vue').default
  app = harness.setup(() => component.setup({}, { expose() {} }))
  for (const callback of harness.mounted) await callback()
  await harness.vue.nextTick()
  assert.equal(app.authenticated.value, true)
  assert.ok(requests.includes('/api/editor-options'))
  assert.deepEqual(app.profiles.coreTypes.value, ['Xray', 'sing_box'])
  assert.equal(app.settings.settings.value.coreTypes[0].coreType, 'Xray')

  app.profiles.profileModalState.profileForm = { password: 'test-password' }
  app.profiles.profileModalState.showProfileForm = true
  app.profiles.exportModalState.exportContent = 'test-share-link'
  app.profiles.exportModalState.showExportDialog = true
  app.subscriptions.subscriptionModalState.subscriptionForm = { url: 'https://private.example' }
  app.subscriptions.subscriptionModalState.showSubscriptionForm = true
  app.routing.ruleModalState.showRuleForm = true
  app.maintenance.webdavForm.value.password = 'test-webdav-password'
  app.settings.inboundForm.value.pass = 'test-inbound-password'
  app.logs.logs.value = [{ message: 'test-private-log' }]
  app.contextMenu.value = { profile: { password: 'test-password' } }
  const confirmation = app.confirmDestructive('test-delete')
  const queuedConfirmation = app.confirmDestructive('test-delete-queued')

  expired = true
  await assert.rejects(app.api.request('/api/status'), (error) => error.status === 401)
  await harness.vue.nextTick()
  assert.equal(app.authenticated.value, false)
  assert.equal(storage.has('v2rayn-api-session:same-origin'), false)
  assert.equal(app.profiles.profileModalState.showProfileForm, false)
  assert.deepEqual(app.profiles.profileModalState.profileForm, {})
  assert.equal(app.profiles.exportModalState.showExportDialog, false)
  assert.equal(app.profiles.exportModalState.exportContent, '')
  assert.equal(app.subscriptions.subscriptionModalState.showSubscriptionForm, false)
  assert.deepEqual(app.subscriptions.subscriptionModalState.subscriptionForm, {})
  assert.equal(app.routing.ruleModalState.showRuleForm, false)
  assert.equal(app.maintenance.webdavForm.value.password, '')
  assert.deepEqual(app.settings.inboundForm.value, {})
  assert.deepEqual(app.logs.logs.value, [])
  assert.equal(app.contextMenu.value, null)
  assert.equal(await confirmation, false)
  assert.equal(await queuedConfirmation, false)
  assert.ok(eventSources.every((source) => source.closed))
})
