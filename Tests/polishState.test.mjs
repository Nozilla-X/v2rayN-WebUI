import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

function fixture(t) {
  const harness = createSourceHarness()
  const previous = globalThis.window
  globalThis.window = { removeEventListener() {} }
  t.after(async () => { await harness.dispose(); if (previous === undefined) delete globalThis.window; else globalThis.window = previous })
  const { useUiRequests, provideUiRequests } = harness.loadSource('Src/UI/useUiRequests.ts')
  const ui = harness.setup(() => useUiRequests(async () => false))
  provideUiRequests(ui)
  return { harness, ui }
}

test('presentation request tracking preserves arguments, results, failures and cancellation generations', async t => {
  const { ui, harness } = fixture(t)
  const pending = []
  const call = (...args) => new Promise((resolve, reject) => pending.push({ args, resolve, reject }))
  const api = ui.decorate({ request: call, data: call, download: call })
  const init = { method: 'PUT', body: { password: 'memory-only-fixture' }, signal: new AbortController().signal }
  const saving = api.request('/api/settings/apply', init)
  assert.equal(pending[0].args[1], init)
  assert.equal(ui.state('settings').writes, 1)
  const result = { success: true }
  pending[0].resolve(result)
  assert.equal(await saving, result)
  assert.equal(ui.state('settings').writes, 0)
  assert.equal(ui.state('settings').committed.path, '/api/settings/apply')
  const loading = api.data('/api/profiles?filter=fixture')
  const error = new Error('fixture network failure')
  pending[1].reject(error)
  await assert.rejects(loading, issue => issue === error)
  assert.equal(ui.state('nodes').error, error.message)
  const old = api.data('/api/profiles')
  ui.reset()
  pending[2].resolve(['old result'])
  assert.deepEqual(await old, ['old result'])
  assert.equal(ui.state('nodes').reads, 0)
  assert.equal(ui.state('nodes').error, '')
  assert.equal(pending.length, 3, 'tracking does not add, retry or suppress requests')
  const firstLogLoad = api.data('/api/logs/page')
  const transitions = []
  harness.vue.watch(() => ui.state('logs').reads, value => transitions.push(value), { flush: 'sync' })
  pending[3].resolve({ items: [] })
  await firstLogLoad
  assert.deepEqual(transitions, [0], 'the first request must finish reactively, not leave a stale loading indicator')
})

test('draft baselines accept only the submitted Core, preserve later edits and retain failed drafts', async t => {
  const { harness, ui } = fixture(t)
  const { useDraftState } = harness.loadSource('Src/UI/useDraftState.ts')
  const models = harness.vue.ref({ xray: { config: 'A' }, sing_box: { config: 'B' } })
  const draft = harness.setup(() => useDraftState('templates', () => models.value, () => models.value, path => [path.split('/').at(-1).toLowerCase()]))
  const pending = []
  const api = ui.decorate({ request: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) })
  models.value.xray.config = 'edited Xray'
  models.value.sing_box.config = 'edited sing-box'
  assert.equal(draft.dirty.value, true)
  const first = api.request('/api/settings/core-templates/Xray', { method: 'PUT' })
  models.value.xray.config = 'typed while saving'
  pending[0].resolve({})
  await first
  await harness.vue.nextTick()
  assert.equal(draft.dirty.value, true)
  const second = api.request('/api/settings/core-templates/sing_box', { method: 'PUT' })
  pending[1].resolve({})
  await second
  await harness.vue.nextTick()
  assert.equal(draft.dirty.value, true, 'the unsaved Xray text is not cleared by saving sing-box')
  const third = api.request('/api/settings/core-templates/Xray', { method: 'PUT' })
  pending[2].reject(new Error('save failed'))
  await assert.rejects(third)
  await harness.vue.nextTick()
  assert.equal(draft.dirty.value, true)
  assert.equal(await draft.allowDiscard('discard?'), false)
  assert.equal(ui.dirty(), true)
  models.value = { xray: { config: 'canonical' }, sing_box: { config: 'canonical' } }
  await harness.vue.nextTick()
  assert.equal(draft.dirty.value, false)
})

test('reloading one canonical section cannot falsely clear a different unsaved section', async t => {
  const { harness } = fixture(t)
  const { useDraftState } = harness.loadSource('Src/UI/useDraftState.ts')
  const simple = harness.vue.ref({ value: 'simple' })
  const core = harness.vue.ref({ value: 'Core' })
  const draft = harness.setup(() => useDraftState('dns', () => ({ simple: simple.value, core: core.value }), () => ({ simple: simple.value, core: core.value }), () => []))
  core.value.value = 'unsaved Core'
  simple.value = { value: 'saved simple' }
  await harness.vue.nextTick()
  assert.deepEqual(draft.dirtyKeys.value, ['core'])
})
