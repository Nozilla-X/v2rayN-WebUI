import assert from 'node:assert/strict'
import test from 'node:test'
import { createSourceHarness } from './helpers/loadSource.mjs'
import { ref } from 'vue'

function fakeClock() {
  let now = 0
  let nextId = 1
  const timers = new Map()
  return {
    setTimeout: (callback, delay) => {
      const id = nextId++
      timers.set(id, { callback, at: now + delay })
      return id
    },
    clearTimeout: (id) => timers.delete(id),
    tick(milliseconds) {
      const target = now + milliseconds
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        now = next[1].at
        timers.delete(next[0])
        next[1].callback()
      }
      now = target
    },
    get pending() { return timers.size },
  }
}

async function settle() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve()
}

test('pausing live logs freezes intake without disconnecting SSE or pausing runtime events', async t => {
  const paused = ref(true)
  const logs = ref([])
  const status = ref({})
  const { source, sources, clock } = await eventFixture(t, { activePage: ref('logs'), logsPaused: paused, logs, status })
  source.emit('log', { message: 'hidden while paused' })
  source.emit('traffic', { proxyUp: 123 })
  clock.tick(100)
  assert.deepEqual(logs.value, [])
  assert.equal(status.value.traffic.proxyUp, 123)
  paused.value = false
  source.emit('log', { message: 'visible after resume' })
  clock.tick(100)
  assert.equal(logs.value[0].message, 'visible after resume')
  assert.equal(sources.length, 1)
  assert.notEqual(source.closed, true)
})

test('speedtest start and empty-ID terminal notifications reconcile actual running operations', async t => {
  const results = []
  const { source, calls, clock } = await eventFixture(t, { onSpeedTestResult: result => results.push(result) })
  source.emit('speedtest-started', { action: 'tcping', profileIds: ['fixture-a'] })
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 1)
  source.emit('speedtest-result', { indexId: 'fixture-a', delay: 123, speed: null })
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 1, 'numeric packets update rows without causing an operation request storm')
  source.emit('speedtest-result', { indexId: '', delay: null, speed: null, rawResult: 'Backend-wide terminal fixture' })
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 2, 'completion must remove the stale speedtest-running state')
  assert.equal(results[0].delay, 123)
})

async function eventFixture(t, extra = {}) {
  const harness = createSourceHarness()
  const clock = fakeClock()
  const original = { EventSource: globalThis.EventSource, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout }
  const sources = []
  globalThis.setTimeout = clock.setTimeout
  globalThis.clearTimeout = clock.clearTimeout
  globalThis.EventSource = class {
    constructor() { this.listeners = new Map(); sources.push(this) }
    addEventListener(type, handler) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set())
      this.listeners.get(type).add(handler)
    }
    removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler) }
    emit(type, payload) {
      const event = { data: JSON.stringify(payload) }
      for (const handler of this.listeners.get(type) || []) handler(event)
    }
    close() { this.closed = true }
  }
  const { useEvents } = harness.loadSource('Src/Composables/useEvents.ts')
  const calls = { operations: 0, completions: 0, progress: [] }
  const events = harness.setup(() => useEvents({
    token: harness.vue.ref('test-session'), activePage: harness.vue.ref('maintenance'), status: harness.vue.ref({}),
    logs: harness.vue.ref([]), logTotal: harness.vue.ref(0), logPage: harness.vue.ref(1), logPageSize: 100,
    request: async () => ({ data: { ticket: 'test-ticket' } }),
    t: (key) => key, showNotice() {}, matchesLogFilter: () => true,
    loadGroups: async () => {}, loadProfiles: async () => {}, loadSubscriptions: async () => {}, loadStatus: async () => {}, loadRouting: async () => {},
    loadOperations: async () => { calls.operations += 1 },
    onCoreUpdateProgress: (progress) => calls.progress.push(progress), onCoreUpdateBatchComplete() {},
    onGeoUpdateComplete: () => { calls.completions += 1 }, onSpeedTestResult() {}, onLogsCleared() {},
    ...extra,
  }))
  t.after(async () => {
    await harness.dispose()
    globalThis.setTimeout = original.setTimeout
    globalThis.clearTimeout = original.clearTimeout
    if (original.EventSource === undefined) delete globalThis.EventSource
    else globalThis.EventSource = original.EventSource
  })
  events.openEvents()
  await settle()
  assert.equal(sources.length, 1)
  return { events, source: sources[0], sources, calls, clock }
}

test('50,000 Geo progress events do not generate a request or render storm, while completion still refreshes', async (t) => {
  const { source, calls, clock } = await eventFixture(t)
  source.emit('core-update-progress', { coreType: 'GeoFiles', phase: 'downloading', isComplete: false })
  for (let index = 0; index < 50_000; index += 1) {
    source.emit('geo-update-progress', { success: false, rawLog: `Download progress ${index}` })
  }
  assert.ok(calls.operations <= 1, `Geo progress generated ${calls.operations} API requests before the coalesced refresh`)
  assert.equal(calls.progress.length, 1)
  assert.equal(clock.pending, 1)
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 1)

  source.emit('core-update-progress', { coreType: 'GeoFiles', phase: 'completed', isComplete: true, success: true })
  source.emit('geo-update-completed', { success: true, messageKey: 'common.completed' })
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 2)
  assert.equal(calls.completions, 1)
  assert.equal(calls.progress.at(-1).phase, 'completed')
})

test('Geo raw progress without a phase event refreshes operation state only once at startup', async (t) => {
  const { source, calls, clock } = await eventFixture(t)
  for (let index = 0; index < 5000; index += 1) source.emit('geo-update-progress', { rawLog: 'progress' })
  clock.tick(500)
  await settle()
  assert.equal(calls.operations, 1)
  for (let index = 0; index < 5000; index += 1) source.emit('geo-update-progress', { rawLog: 'progress' })
  clock.tick(5000)
  await settle()
  assert.equal(calls.operations, 1)
})

test('slow operation refreshes never overlap and retain one trailing completion refresh', async (t) => {
  let calls = 0
  let active = 0
  let maximumActive = 0
  const completions = []
  const { source, clock } = await eventFixture(t, {
    loadOperations: () => {
      calls += 1
      active += 1
      maximumActive = Math.max(maximumActive, active)
      return new Promise((resolve) => completions.push(() => { active -= 1; resolve() }))
    },
  })
  source.emit('core-update-progress', { coreType: 'Xray', phase: 'checking', isComplete: false })
  clock.tick(500)
  await settle()
  assert.equal(calls, 1)
  for (let index = 0; index < 5000; index += 1) {
    source.emit('core-update-progress', { coreType: 'Xray', phase: 'checking', isComplete: false })
  }
  source.emit('core-update-progress', { coreType: 'Xray', phase: 'completed', isComplete: true })
  clock.tick(5000)
  await settle()
  assert.equal(calls, 1)
  completions.shift()()
  await settle()
  clock.tick(500)
  await settle()
  assert.equal(calls, 2)
  assert.equal(maximumActive, 1)
  completions.shift()()
  await settle()
})

test('closing SSE cancels queued operation refreshes', async (t) => {
  const { events, source, calls, clock } = await eventFixture(t)
  source.emit('geo-update-progress', { rawLog: 'progress' })
  events.closeEvents()
  clock.tick(5000)
  await settle()
  assert.equal(calls.operations, 0)
  assert.equal(clock.pending, 0)
})

test('closing SSE also cancels a refresh whose timer fired before its microtask ran', async (t) => {
  const { events, source, calls, clock } = await eventFixture(t)
  source.emit('geo-update-progress', { rawLog: 'progress' })
  clock.tick(500)
  events.closeEvents()
  await settle()
  assert.equal(calls.operations, 0)
  assert.equal(clock.pending, 0)
})

test('Core download progress renders only the latest packet and never regresses after completion', async (t) => {
  const { source, calls, clock } = await eventFixture(t)
  source.emit('core-update-progress', { coreType: 'Xray', phase: 'downloading', isComplete: false, detail: 'start' })
  for (let index = 0; index < 50_000; index += 1) {
    source.emit('core-update-progress', { coreType: 'Xray', phase: 'downloading', isComplete: false, detail: String(index) })
  }
  assert.equal(calls.progress.length, 1)
  assert.equal(calls.operations, 0)
  clock.tick(100)
  await settle()
  assert.equal(calls.progress.length, 2)
  assert.equal(calls.progress.at(-1).detail, '49999')
  source.emit('core-update-progress', { coreType: 'Xray', phase: 'downloading', isComplete: false, detail: 'late packet' })
  source.emit('core-update-progress', { coreType: 'Xray', phase: 'completed', isComplete: true })
  assert.equal(calls.progress.at(-1).phase, 'completed')
  clock.tick(500)
  await settle()
  assert.equal(calls.progress.length, 3)
  assert.equal(calls.progress.at(-1).phase, 'completed')
})

test('operation loads share one in-flight request and do not rerender unchanged lists', async () => {
  const harness = createSourceHarness()
  const { useRuntime } = harness.loadSource('Src/Composables/useRuntime.ts')
  let resolve
  let calls = 0
  const runtime = useRuntime({
    data: () => { calls += 1; return new Promise((complete) => { resolve = complete }) },
    request: async () => ({}), operationMessage: () => 'ok', showNotice() {}, showError() {},
  })
  const loads = Array.from({ length: 5000 }, () => runtime.loadOperations())
  assert.equal(calls, 1)
  resolve(['core', 'geo-update'])
  await Promise.all(loads)
  const list = runtime.operations.value
  const unchanged = runtime.loadOperations()
  resolve(['core', 'geo-update'])
  await unchanged
  assert.equal(runtime.operations.value, list)
})

test('session reset prevents an old operation response from restoring the previous state', async () => {
  const harness = createSourceHarness()
  const { useRuntime } = harness.loadSource('Src/Composables/useRuntime.ts')
  const pending = []
  const runtime = useRuntime({
    data: () => new Promise((resolve) => pending.push(resolve)), request: async () => ({}),
    operationMessage: () => 'ok', showNotice() {}, showError() {},
  })
  const old = runtime.loadOperations()
  runtime.reset()
  const current = runtime.loadOperations()
  pending[1](['core'])
  await current
  pending[0](['geo-update'])
  await old
  assert.deepEqual(runtime.operations.value, ['core'])
})

test('Geo update submission ignores double clicks while the request is pending', async () => {
  const harness = createSourceHarness()
  const { useMaintenance } = harness.loadSource('Src/Composables/useMaintenance.ts')
  const requests = []
  let finishSave
  const maintenance = useMaintenance({
    t: (key) => key, translateKey: (key) => key, showNotice() {}, showError: (error) => { throw error }, confirm: async () => true,
    token: harness.vue.ref('test-session'), status: harness.vue.ref(null), operations: harness.vue.ref([]),
    data: async () => [], operationMessage: () => 'ok', loadOperations: async () => {}, loadProfiles: async () => {},
    request: (route) => {
      requests.push(route)
      return route === '/api/core-updates/settings'
        ? new Promise((resolve) => { finishSave = () => resolve({}) })
        : Promise.resolve({})
    },
  })
  const first = maintenance.maintenancePageActions.updateGeo()
  assert.equal(maintenance.maintenancePageState.geoUpdateSubmitting, true)
  await maintenance.maintenancePageActions.updateGeo()
  assert.deepEqual(requests, ['/api/core-updates/settings'])
  finishSave()
  await first
  assert.deepEqual(requests, ['/api/core-updates/settings', '/api/core/geo/update'])
  assert.equal(maintenance.maintenancePageState.geoUpdateSubmitting, false)
})
