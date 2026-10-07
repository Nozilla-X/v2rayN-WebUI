import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, readdir } from 'node:fs/promises'
import { createSourceHarness } from './helpers/loadSource.mjs'

function harnessFor(t, overrides = {}) {
  const harness = createSourceHarness()
  const names = ['fetch', 'localStorage', 'window', 'location', 'document', 'EventSource']
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]))
  const storage = new Map()
  globalThis.location = { origin: 'https://dashboard.example', protocol: 'https:' }
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, removeEventListener() {} }
  globalThis.document = { documentElement: { dataset: {}, style: {} }, querySelector: () => null, addEventListener() {}, removeEventListener() {} }
  Object.assign(globalThis, overrides)
  t.after(async () => {
    await harness.dispose()
    for (const name of names) {
      if (previous[name] === undefined) delete globalThis[name]
      else globalThis[name] = previous[name]
    }
  })
  return { harness, storage, endpoint: harness.loadSource('Src/Composables/apiEndpoint.ts') }
}

test('API base normalization accepts only http(s) endpoints and keeps proxy prefixes', t => {
  const { endpoint } = harnessFor(t)
  for (const [input, expected] of [['', ''], ['  ', ''], ['HTTP://EXAMPLE.COM:80/proxy/// ', 'http://example.com/proxy'], ['https://API.example.com:443', 'https://api.example.com'], ['http://[::1]:5080/', 'http://[::1]:5080']]) {
    assert.equal(endpoint.normalizeApiBase(input), expected)
  }
  for (const input of ['ftp://example.com', '//example.com', 'http://user:secret@example.com', 'https://example.com?q=1', 'https://example.com?', 'https://example.com#fragment', 'http://bad\\host', 'not a URL']) assert.throws(() => endpoint.normalizeApiBase(input))
})

test('REST, login, setup, backup and SSE paths compose without losing the path prefix', t => {
  const { endpoint } = harnessFor(t)
  for (const route of ['/api/status', '/api/auth/login', '/api/setup', '/api/backup/download', '/api/auth/sse-ticket', '/api/events?sse_ticket=one&include_logs=true']) {
    assert.equal(endpoint.resolveApiUrl(route), route)
    assert.equal(endpoint.resolveApiUrl(route, 'http://127.0.0.1:5080/proxy/'), 'http://127.0.0.1:5080/proxy' + route)
  }
  for (const route of ['https://evil.example/api', '//evil.example/api', '/NotifyIcon1.ico', '/api/../../outside', '/api/%2e%2e/outside']) assert.throws(() => endpoint.resolveApiUrl(route, 'https://api.example/prefix'))
})

test('session identity includes normalized origin and prefix, not just the WebUI origin', t => {
  const { endpoint } = harnessFor(t)
  assert.equal(endpoint.sessionStorageKey('http://127.0.0.1:5080/'), endpoint.sessionStorageKey('http://127.0.0.1:5080'))
  assert.equal(endpoint.sessionStorageKey(''), endpoint.sessionStorageKey('https://dashboard.example'))
  assert.notEqual(endpoint.sessionStorageKey('http://127.0.0.1:5080'), endpoint.sessionStorageKey('http://192.168.1.10:5080'))
  assert.notEqual(endpoint.sessionStorageKey('https://api.example/a'), endpoint.sessionStorageKey('https://api.example/b'))
})

test('explicit localhost and private IP address spaces are recognized without DNS requests', t => {
  const { endpoint } = harnessFor(t)
  for (const host of ['localhost', '127.0.0.1', '[::1]']) assert.equal(endpoint.addressSpace(`http://${host}:5080`), 'loopback')
  for (const host of ['10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '[fd00::1]']) assert.equal(endpoint.addressSpace(`http://${host}:5080`), 'local')
  for (const host of ['172.32.0.1', '8.8.8.8', 'api.example', '127.attacker.example']) assert.equal(endpoint.addressSpace(`http://${host}:5080`), 'public')
  assert.deepEqual(endpoint.localNetworkFetchOptions('http://127.0.0.1:5080'), {}) // unsupported Node/Firefox extension
  assert.equal(endpoint.networkFailureKey('http://127.0.0.1:5080'), 'backend.localNetworkFailure')
  assert.equal(endpoint.networkFailureKey('http://api.example'), 'backend.mixedContentFailure')
})

test('all requests use one resolver, public exchanges omit Bearer and redirects/cookies are disabled', async t => {
  const { harness } = harnessFor(t)
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  const calls = []
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ success: true, data: {} }) }
  const api = useApi({ getBase: () => 'http://127.0.0.1:5080/prefix', getToken: () => 'scoped-token', onUnauthorized() {}, translateKey: key => key })
  await api.publicRequest('/api/auth/login', { method: 'POST', body: { key: 'input-only-key' } })
  await api.request('/api/status')
  assert.equal(calls[0].url, 'http://127.0.0.1:5080/prefix/api/auth/login')
  assert.equal(calls[0].init.headers.has('Authorization'), false)
  assert.equal(calls[1].init.headers.get('Authorization'), 'Bearer scoped-token')
  assert.equal(calls[1].init.credentials, 'omit')
  assert.equal(calls[0].init.redirect, 'error')
})

test('Backend switching aborts login as well as REST; late responses cannot install old tokens', async t => {
  const { harness } = harnessFor(t)
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  const { useSession } = harness.loadSource('Src/Composables/useSession.ts')
  let base = 'http://127.0.0.1:5080/a'
  const token = harness.vue.ref('')
  const authenticated = harness.vue.ref(false)
  const pending = []
  globalThis.fetch = async (url, init) => url.endsWith('/api/setup/status')
    ? Response.json({ setupRequired: false })
    : new Promise(resolve => pending.push({ url, init, resolve }))
  const api = useApi({ getBase: () => base, getToken: () => token.value, onUnauthorized() {}, translateKey: key => key })
  const session = harness.setup(() => useSession({ token, authenticated, loading: harness.vue.ref(false), ...api, t: key => key, showNotice() {}, showError() {}, closeEvents() {}, openEvents() {}, refreshData: async () => {}, loadConnectedData: async () => {}, loadProfiles: async () => {}, resetSessionData: api.cancelPendingRequests }))
  session.managementKeyDraft.value = 'old-input-key'
  const login = session.login()
  while (!pending.length) await Promise.resolve()
  session.clearSession()
  base = 'http://192.168.1.10:5080/b'
  assert.equal(pending[0].init.signal.aborted, true)
  pending[0].resolve(Response.json({ success: true, data: { token: 'old-backend-token' } }))
  await login
  assert.equal(token.value, '')
  assert.equal(authenticated.value, false)
  const rest = api.request('/api/status')
  assert.equal(pending[1].url, base + '/api/status')
  assert.equal(pending[1].init.headers.has('Authorization'), false)
  pending[1].resolve(Response.json({ success: true }))
  await rest
})

test('standalone App does not touch the API on load, and changing Backend clears SSE/runtime/drafts', async t => {
  const { harness, storage } = harnessFor(t)
  window.__V2RAYN_WEBUI_CONFIG__ = { apiBaseUrl: 'http://127.0.0.1:5080' }
  storage.set('v2rayn-web-token', 'legacy-unscoped-token')
  let calls = 0
  const cleanupRequests = []
  globalThis.fetch = async (url, init) => { calls++; cleanupRequests.push({ url, init }); return Response.json({ success: true }) }
  const component = harness.loadSource('Src/App.vue').default
  const app = harness.setup(() => component.setup({}, { expose() {} }))
  for (const hook of harness.mounted) await hook()
  assert.equal(calls, 0)
  assert.equal(app.sessionToken.value, '')
  app.sessionToken.value = 'old-scoped-token'
  app.runtime.status.value = { coreRunning: true }
  app.session.managementKeyDraft.value = 'input-only-key'
  app.backend.draft.value = 'http://192.168.1.10:5080'
  assert.equal(app.applyBackend(), true)
  assert.equal(app.sessionToken.value, '')
  assert.equal(app.runtime.status.value, null)
  assert.equal(app.session.managementKeyDraft.value, '')
  assert.equal(calls, 1)
  assert.equal(cleanupRequests[0].url, 'http://127.0.0.1:5080/api/auth/logout')
  assert.equal(cleanupRequests[0].init.headers.get('Authorization'), 'Bearer old-scoped-token')
  assert.ok([...storage.values()].every(value => !value.includes('token') && !value.includes('input-only-key')))
})

test('new API update identity is consumed without breaking the legacy API name', async t => {
  const { harness } = harnessFor(t)
  const { useMaintenance } = harness.loadSource('Src/Composables/useMaintenance.ts')
  let saved
  const maintenance = useMaintenance({ t: key => key, translateKey: key => key, showNotice() {}, showError: error => { throw error }, token: harness.vue.ref(''), status: harness.vue.ref(null), operations: harness.vue.ref([]), loadOperations: async () => {}, data: async path => path === '/api/web-updates' ? { name: 'v2rayN.WebAPI', selected: true } : path === '/api/core-updates' ? { targets: [], checkPreReleaseCoreTypes: [] } : path.endsWith('/progress') ? [] : {}, request: async (_path, init) => { saved = init.body; return {} }, operationMessage: () => '' })
  await maintenance.loadMaintenance()
  maintenance.maintenancePageActions.setPreReleaseTarget('v2rayN.WebAPI', true)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(saved.selectedCoreTypes, ['v2rayN.WebAPI'])
  assert.deepEqual(saved.checkPreReleaseCoreTypes, ['v2rayN.WebAPI'])
})

test('SSE EventSource uses the selected Backend prefix and discards an old pending ticket', async t => {
  const { harness } = harnessFor(t)
  const { useEvents } = harness.loadSource('Src/Composables/useEvents.ts')
  const { resolveApiUrl } = harness.loadSource('Src/Composables/apiEndpoint.ts')
  const sources = []
  globalThis.EventSource = class {
    constructor(url) { this.url = url; sources.push(this) }
    listeners = new Map()
    addEventListener(name, listener) { this.listeners.set(name, listener) }
    removeEventListener(name) { this.listeners.delete(name) }
    close() { this.closed = true }
  }
  let complete
  const status = harness.vue.ref(null)
  const events = harness.setup(() => useEvents({ token: harness.vue.ref('session'), activePage: harness.vue.ref('nodes'), status, logs: harness.vue.ref([]), logTotal: harness.vue.ref(0), logPage: harness.vue.ref(1), logPageSize: 100, t: key => key, showNotice() {}, matchesLogFilter: () => true, request: () => new Promise(resolve => { complete = resolve }), resolveUrl: route => resolveApiUrl(route, 'http://127.0.0.1:5080/prefix'), loadOperations: async () => {} }))
  events.openEvents()
  complete({ data: { ticket: 'one-time-ticket' } })
  await Promise.resolve()
  assert.equal(sources[0].url, 'http://127.0.0.1:5080/prefix/api/events?sse_ticket=one-time-ticket&include_logs=false')
  events.openEvents()
  assert.equal(sources[0].closed, true)
  events.closeEvents()
  complete({ data: { ticket: 'old-ticket' } })
  await Promise.resolve()
  assert.equal(sources.length, 1)
  sources[0].listeners.get('status')({ data: JSON.stringify({ privateOldBackend: true }) })
  assert.equal(status.value, null, 'late old SSE messages cannot restore runtime state')
})

test('changing sessions resets the old Backend log generation as well as reactive logs', async t => {
  const { harness } = harnessFor(t)
  const { useEvents } = harness.loadSource('Src/Composables/useEvents.ts')
  const sources = []
  globalThis.EventSource = class {
    constructor() { sources.push(this) }
    listeners = new Map()
    addEventListener(name, listener) { this.listeners.set(name, listener) }
    removeEventListener(name) { this.listeners.delete(name) }
    close() {}
    emit(name, data) { this.listeners.get(name)?.({ data: JSON.stringify(data) }) }
  }
  const logs = harness.vue.ref([])
  const events = harness.setup(() => useEvents({ token: harness.vue.ref('session'), activePage: harness.vue.ref('logs'), status: harness.vue.ref(null), logs, logTotal: harness.vue.ref(0), logPage: harness.vue.ref(1), logPageSize: 100, t: key => key, showNotice() {}, matchesLogFilter: () => true, request: async () => ({ data: { ticket: 'ticket' } }), loadOperations: async () => {}, onLogsCleared() {} }))
  events.openEvents(); await Promise.resolve()
  sources[0].emit('logs-cleared', { generation: 10 })
  events.resetEvents()
  events.openEvents(); await Promise.resolve()
  sources[1].emit('log', { generation: 0, message: 'new Backend log' })
  await new Promise(resolve => setTimeout(resolve, 100))
  assert.equal(logs.value[0]?.message, 'new Backend log')
})

test('setup uses the shared public transport and endpoint-scoped storage, never WebUI origin or Management Key persistence', async t => {
  const { harness, storage, endpoint } = harnessFor(t)
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  const { useSession } = harness.loadSource('Src/Composables/useSession.ts')
  const calls = []
  const base = 'https://api.example/reverse-proxy'
  const token = harness.vue.ref('')
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return Response.json({ token: 'new-session-token' }) }
  const api = useApi({ getBase: () => base, getToken: () => token.value, onUnauthorized() {}, translateKey: key => key })
  const session = harness.setup(() => useSession({ token, authenticated: harness.vue.ref(false), loading: harness.vue.ref(false), ...api, storageKey: () => endpoint.sessionStorageKey(base), t: key => key, showNotice() {}, showError: error => { throw error }, closeEvents() {}, openEvents() {}, refreshData: async () => {}, loadConnectedData: async () => {}, loadProfiles: async () => {}, resetSessionData() {} }))
  // A real cross-origin Backend reports false. Exercise its URL only with an
  // explicitly allowed fixture; setup denial itself is covered by Backend tests.
  session.setupAllowedFromRequest.value = true
  session.setupKey.value = session.setupConfirmKey.value = 'input-only-management-key'
  await session.configureManagementKey()
  assert.equal(calls[0].url, base + '/api/setup')
  assert.equal(calls[0].init.headers.has('Authorization'), false)
  assert.equal(storage.get(endpoint.sessionStorageKey(base)), 'new-session-token')
  assert.equal([...storage.values()].includes('input-only-management-key'), false)
})

test('network calls cannot regress to scattered fetches, and icons/config belong to the UI origin', async () => {
  async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory)
      if (entry.isDirectory()) await check(file)
      else if (/\.(ts|js|vue)$/.test(entry.name)) {
        const source = await readFile(file, 'utf8')
        if (entry.name !== 'useApi.ts') assert.doesNotMatch(source, /\bfetch\s*\(/, file.pathname)
        if (entry.name !== 'useEvents.ts') assert.doesNotMatch(source, /new\s+EventSource\s*\(/, file.pathname)
      }
    }
  }
  await check(new URL('../Src/', import.meta.url))
  const app = await readFile(new URL('../Src/App.vue', import.meta.url), 'utf8')
  assert.match(app, /proxy: '\.\/NotifyIcon2.ico', off: '\.\/NotifyIcon1.ico'/)
  assert.match(app, /const brandLogoSrc = '\.\/v2rayN.png'/)
  assert.match(app, /:src="brandLogoSrc"/)
  const index = await readFile(new URL('../index.html', import.meta.url), 'utf8')
  assert.match(index, /src="\.\/webui-config.js"/)
})
