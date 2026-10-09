import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'

test('a profiles response started before SSE results cannot overwrite the new delay and speed', async t => {
  const harness = createSourceHarness()
  t.after(() => harness.dispose())
  const { useProfiles } = harness.loadSource('Src/Composables/useProfiles.ts')
  let finish
  const profiles = harness.setup(() => useProfiles({
    t: key => key, showNotice() {}, showError: error => { throw error }, confirm: async () => true,
    busy: harness.vue.ref(false), operations: harness.vue.ref([]), contextMenu: harness.vue.ref(null),
    data: () => new Promise(resolve => { finish = resolve }), queryPath: path => path,
    loadStatus: async () => {}, loadOperations: async () => {},
  }))
  profiles.profiles.value = [{ indexId: 'fixture-a', delay: 10, speed: 1 }]
  const loading = profiles.loadProfiles()
  profiles.nodesPageActions.applySpeedTestResult({ indexId: 'fixture-a', delay: 123, speed: 7.5 })
  finish([{ indexId: 'fixture-a', delay: 10, speed: 1 }])
  await loading
  assert.equal(profiles.profiles.value[0].delay, 123)
  assert.equal(profiles.profiles.value[0].speed, 7.5)
  const newerLoad = profiles.loadProfiles()
  finish([{ indexId: 'fixture-a', delay: 150, speed: 8 }])
  await newerLoad
  assert.equal(profiles.profiles.value[0].delay, 150, 'a later canonical request remains authoritative')
  assert.equal(profiles.profiles.value[0].speed, 8)
})
