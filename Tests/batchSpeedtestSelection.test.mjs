import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createSourceHarness } from './helpers/loadSource.mjs'

function createApp(t) {
  const harness = createSourceHarness()
  const names = ['window', 'document', 'localStorage', 'Element']
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]))
  globalThis.window = { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), removeEventListener() {} }
  globalThis.document = { documentElement: { dataset: {}, style: {} }, querySelector: () => null, removeEventListener() {} }
  globalThis.localStorage = { getItem: () => null, setItem() {} }
  globalThis.Element = class {}
  t.after(async () => {
    await harness.dispose()
    for (const name of names) {
      if (previous[name] === undefined) delete globalThis[name]
      else globalThis[name] = previous[name]
    }
  })
  const component = harness.loadSource('Src/App.vue').default
  const app = harness.setup(() => component.setup({}, { expose() {} }))
  app.profiles.profiles.value = ['A', 'B', 'C'].map(indexId => ({ indexId }))
  const calls = []
  app.nodesPageActions.startSpeedTest = (action, ids) => { calls.push({ action, ids }); return Promise.resolve() }
  const openContext = id => app.nodesPageActions.openContext({ clientX: 10, clientY: 10, preventDefault() {} }, { indexId: id })
  return { app, calls, openContext }
}

test('all context speedtests retain the full selection when opened on a selected node', (t) => {
  const { app, calls, openContext } = createApp(t)
  app.profiles.selectedIds.value = ['A', 'B']
  openContext('B')
  for (const action of ['tcping', 'realping', 'speedtest', 'udpTest']) app.testSelectedNodes(action)
  assert.deepEqual(calls, ['tcping', 'realping', 'speedtest', 'udpTest'].map(action => ({ action, ids: ['A', 'B'] })))
  assert.deepEqual(app.profiles.selectedIds.value, ['A', 'B'])
})

test('right-clicking an unselected node deliberately replaces the previous selection', (t) => {
  const { app, calls, openContext } = createApp(t)
  app.profiles.selectedIds.value = ['A', 'B']
  openContext('C')
  app.testSelectedNodes('speedtest')
  assert.deepEqual(app.profiles.selectedIds.value, ['C'])
  assert.deepEqual(calls, [{ action: 'speedtest', ids: ['C'] }])
})

test('speedtest submission snapshots selection and does not fall back to testing every node', (t) => {
  const { app, calls, openContext } = createApp(t)
  app.profiles.selectedIds.value = ['A', 'B']
  openContext('A')
  app.testSelectedNodes('realping')
  app.profiles.selectedIds.value.push('C')
  assert.deepEqual(calls[0].ids, ['A', 'B'])
  app.profiles.selectedIds.value = []
  app.profiles.profiles.value = []
  app.contextMenu.value = null
  app.testSelectedNodes('speedtest')
  assert.equal(calls.length, 1)
})

test('context-menu speedtests use the same selection resolver as keyboard shortcuts', async () => {
  const source = await readFile(new URL('../Src/App.vue', import.meta.url), 'utf8')
  for (const action of ['tcping', 'realping', 'speedtest', 'udpTest']) {
    assert.ok(source.includes(`@click="testSelectedNodes('${action}')"`))
  }
  assert.doesNotMatch(source, /testSelectedNodes\('[^']+', contextMenu\.profile\)/)
})
