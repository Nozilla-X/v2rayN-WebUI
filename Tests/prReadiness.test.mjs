import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

test('blocked storage does not prevent App initialization or language switching', async (t) => {
  const harness = createSourceHarness()
  const names = ['localStorage', 'window', 'document']
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]))
  globalThis.localStorage = {
    getItem() { throw new DOMException('Blocked', 'SecurityError') },
    setItem() { throw new DOMException('Blocked', 'SecurityError') },
  }
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), removeEventListener() {} }
  globalThis.document = { documentElement: { dataset: {}, style: {} }, querySelector: () => null, removeEventListener() {} }
  t.after(async () => {
    await harness.dispose()
    for (const name of names) {
      if (previous[name] === undefined) delete globalThis[name]
      else globalThis[name] = previous[name]
    }
  })
  const { readStoredValue, writeStoredValue } = harness.loadSource('Src/Composables/browserStorage.ts')
  assert.equal(readStoredValue('v2rayn-web-locale'), null)
  assert.doesNotThrow(() => writeStoredValue('v2rayn-web-locale', 'en-US'))
  const component = harness.loadSource('Src/App.vue').default
  const app = harness.setup(() => component.setup({}, { expose() {} }))
  assert.equal(app.sessionToken.value, '')
  app.locale.value = 'en-US'
  await harness.vue.nextTick()
  assert.equal(document.documentElement.lang, 'en-US')
})

test('backup downloads handle JSON and non-JSON 401 and HTTP failures', async (t) => {
  const harness = createSourceHarness()
  const previousFetch = globalThis.fetch
  t.after(async () => { globalThis.fetch = previousFetch; await harness.dispose() })
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  let unauthorized = 0
  const api = useApi({ getToken: () => 'session', onUnauthorized: () => { unauthorized++ }, translateKey: key => key || 'common.operationDone' })
  for (const response of [
    new Response('Unauthorized', { status: 401 }),
    Response.json({ messageKey: 'errors.unauthorized' }, { status: 401 }),
    new Response('Bad Gateway', { status: 502 }),
  ]) {
    globalThis.fetch = async () => response
    await assert.rejects(api.download('/api/backup/download'), error => {
      assert.equal(error.status, response.status)
      assert.notEqual(error.message, 'common.operationDone')
      if (response.status === 502) assert.match(error.message, /HTTP 502/)
      return true
    })
  }
  assert.equal(unauthorized, 2)
})

test('backup downloads retain the binary body and reject results from an old session', async (t) => {
  const harness = createSourceHarness()
  const previousFetch = globalThis.fetch
  t.after(async () => { globalThis.fetch = previousFetch; await harness.dispose() })
  const { useApi } = harness.loadSource('Src/Composables/useApi.ts')
  let token = 'old'
  const api = useApi({ getToken: () => token, onUnauthorized() { assert.fail('old request revoked new session') }, translateKey: key => key })
  globalThis.fetch = async () => new Response('zip bytes', { headers: { 'Content-Disposition': 'attachment; filename="backup.zip"' } })
  const result = await api.download('/api/backup/download')
  assert.equal(await result.blob.text(), 'zip bytes')
  assert.equal(result.filename, 'backup.zip')
  let finish
  globalThis.fetch = () => new Promise(resolve => { finish = resolve })
  const pending = api.download('/api/backup/download')
  token = 'new'
  finish(new Response('Unauthorized', { status: 401 }))
  await assert.rejects(pending, { name: 'AbortError' })
})

function settingsHarness(harness, overrides = {}) {
  const { useSettings } = harness.loadSource('Src/Composables/useSettings.ts')
  return useSettings({
    coreTypes: harness.vue.ref(['Xray']), routingForm: harness.vue.ref({}), routingOptions: harness.vue.ref({}),
    t: key => key, showNotice() {}, showError() {}, loadStatus: async () => {},
    request: async () => ({}), data: async () => ({}), operationMessage: () => 'saved',
    canonicalCode: value => value, ...overrides,
  })
}

test('settings reject out-of-order responses and responses after reset', async (t) => {
  const harness = createSourceHarness()
  t.after(() => harness.dispose())
  const pending = []
  const settings = settingsHarness(harness, { data: () => new Promise(resolve => pending.push(resolve)) })
  const older = settings.loadSettings()
  const newer = settings.loadSettings()
  pending[1]({ inbound: { localPort: 20808 } })
  await newer
  pending[0]({ inbound: { localPort: 10808 } })
  await older
  assert.equal(settings.inboundForm.value.localPort, 20808)
  const beforeReset = settings.loadSettings()
  settings.reset()
  pending[2]({ inbound: { pass: 'old-private-password' } })
  await beforeReset
  assert.deepEqual(settings.inboundForm.value, {})
})

test('settings saves suppress double clicks and release the busy state on failure', async (t) => {
  const harness = createSourceHarness()
  t.after(() => harness.dispose())
  let finish
  let puts = 0
  const settings = settingsHarness(harness, { request: () => { puts++; return new Promise((_resolve, reject) => { finish = reject }) } })
  settings.inboundForm.value = { localPort: 10808 }
  settings.speedForm.value = { speedTestTimeout: 10, mixedConcurrencyCount: 5 }
  const first = settings.settingsPageActions.saveAllSettings()
  assert.equal(settings.settingsPageState.saving, true)
  await settings.settingsPageActions.saveAllSettings()
  assert.equal(puts, 1)
  finish(new Error('Save failed'))
  await first
  assert.equal(settings.settingsPageState.saving, false)
})
