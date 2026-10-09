import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

function backendFixture(t, values = {}, { blockedStorage = false } = {}) {
  const harness = createSourceHarness()
  const previous = {}
  for (const name of ['localStorage', 'window']) previous[name] = globalThis[name]
  const storage = new Map(Object.entries(values))
  globalThis.localStorage = blockedStorage
    ? { getItem() { throw new Error('Blocked') }, setItem() { throw new Error('Blocked') }, removeItem() { throw new Error('Blocked') } }
    : {
        getItem: key => (storage.has(key) ? storage.get(key) : null),
        setItem: (key, value) => storage.set(key, String(value)),
        removeItem: key => storage.delete(key),
      }
  t.after(async () => {
    await harness.dispose()
    for (const name of Object.keys(previous)) {
      if (previous[name] === undefined) delete globalThis[name]
      else globalThis[name] = previous[name]
    }
  })
  return { harness, storage }
}

test('history normalization rejects credentials, duplicates and unsupported input', t => {
  const { harness } = backendFixture(t)
  const { normalizeBackendHistory, backendHistoryLimit } = harness.loadSource('Src/Composables/backendHistory.ts')
  assert.deepEqual(normalizeBackendHistory(['HTTP://EXAMPLE.COM:80/', 'http://example.com', 'https://api.example.com/a///']), ['http://example.com', 'https://api.example.com/a'])
  assert.deepEqual(normalizeBackendHistory(['ftp://example.com', 'http://user:secret@example.com', 'http://example.com?q=1', 'http://example.com#fragment', '', 'not a URL', 42, null]), [])
  const many = Array.from({ length: 14 }, (_, index) => `https://host-${index}.example`)
  assert.equal(normalizeBackendHistory(many).length, backendHistoryLimit)
  assert.deepEqual(normalizeBackendHistory('not-an-array'), [])
})

test('legacy address seeds history once and an explicit empty history is preserved', t => {
  const { harness } = backendFixture(t)
  const { restoreBackendHistory } = harness.loadSource('Src/Composables/backendHistory.ts')
  assert.deepEqual(restoreBackendHistory(null, 'http://127.0.0.1:5080'), ['http://127.0.0.1:5080'])
  assert.deepEqual(restoreBackendHistory(null, 'http://user:secret@example.com'), [])
  assert.deepEqual(restoreBackendHistory('[]', 'http://127.0.0.1:5080'), [])
  assert.deepEqual(restoreBackendHistory('{"broken":', ''), [])
  assert.deepEqual(restoreBackendHistory(JSON.stringify(['https://api.example.com']), 'http://127.0.0.1:5080'), ['https://api.example.com'])
})

test('useBackend restores, records, de-duplicates and forgets addresses without credentials', t => {
  const { harness, storage } = backendFixture(t, {
    'v2rayn-api-endpoint': 'http://127.0.0.1:5080',
    'v2rayn-api-endpoint-history': JSON.stringify(['http://127.0.0.1:5080', 'https://api.example.com']),
  })
  const { useBackend } = harness.loadSource('Src/Composables/useBackend.ts')
  const backend = harness.setup(() => useBackend())
  assert.equal(backend.base.value, 'http://127.0.0.1:5080')
  assert.deepEqual(backend.history.value, ['http://127.0.0.1:5080', 'https://api.example.com'])
  backend.remember('https://api.example.com')
  assert.deepEqual(backend.history.value, ['https://api.example.com', 'http://127.0.0.1:5080'])
  for (const invalid of ['   ', 'http://user:secret@example.com', 'ftp://bad.example', 'not a URL']) backend.remember(invalid)
  assert.deepEqual(backend.history.value, ['https://api.example.com', 'http://127.0.0.1:5080'])
  backend.forget('https://api.example.com/')
  assert.deepEqual(backend.history.value, ['http://127.0.0.1:5080'])
  assert.deepEqual(JSON.parse(storage.get('v2rayn-api-endpoint-history')), ['http://127.0.0.1:5080'])
  backend.setBase('https://api.example.com/prefix/')
  assert.equal(backend.base.value, 'https://api.example.com/prefix')
  assert.deepEqual(backend.history.value, ['http://127.0.0.1:5080'], 'switching the address does not record it by itself')
  backend.remember()
  assert.deepEqual(JSON.parse(storage.get('v2rayn-api-endpoint-history')), ['https://api.example.com/prefix', 'http://127.0.0.1:5080'])
})

test('blocked browser storage degrades to an empty history without throwing', t => {
  const { harness } = backendFixture(t, {}, { blockedStorage: true })
  const { useBackend } = harness.loadSource('Src/Composables/useBackend.ts')
  const backend = harness.setup(() => useBackend())
  assert.deepEqual(backend.history.value, [])
  assert.doesNotThrow(() => backend.remember('http://127.0.0.1:5080'))
  assert.doesNotThrow(() => backend.forget('http://127.0.0.1:5080'))
  assert.doesNotThrow(() => backend.setBase(''))
  assert.equal(backend.base.value, '')
})
