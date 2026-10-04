import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createSourceHarness } from './helpers/loadSource.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function createMaintenance(coreSettings, webTarget = { selected: false }) {
  const harness = createSourceHarness()
  const { useMaintenance } = harness.loadSource('Src/Composables/useMaintenance.ts')
  const dataCalls = []
  const requests = []
  const maintenance = useMaintenance({
    t: (key) => key,
    translateKey: (key) => key || '',
    showNotice() {},
    showError: (error) => { throw error },
    confirm: async () => true,
    token: harness.vue.ref(''),
    status: harness.vue.ref(null),
    operations: harness.vue.ref([]),
    loadOperations: async () => {},
    loadProfiles: async () => {},
    data: async (route) => {
      dataCalls.push(route)
      if (route === '/api/settings/webdav') return {}
      if (route === '/api/core-updates') return coreSettings
      if (route === '/api/core-updates/progress') return []
      if (route === '/api/web-updates') return webTarget
      throw new Error(`Unexpected GET ${route}`)
    },
    request: async (route, init) => {
      requests.push({ route, ...init })
      return { success: true }
    },
    operationMessage: () => 'saved',
  })
  await maintenance.loadMaintenance()
  return { maintenance, dataCalls, requests }
}

function savedSettings(requests, index = requests.length - 1) {
  assert.equal(requests[index]?.route, '/api/core-updates/settings')
  assert.equal(requests[index]?.method, 'PUT')
  return requests[index].body
}

test('GET core-update settings uses checkPreReleaseCoreTypes as the UI state, not legacy preRelease', async () => {
  const { maintenance, dataCalls } = await createMaintenance({
    targets: [
      { coreType: 'Xray', supportsPreRelease: true, selected: true },
      { coreType: 'mihomo', supportsPreRelease: false, selected: true },
    ],
    checkPreReleaseCoreTypes: ['Xray', 'mihomo', 'GeoFiles', 'unknown', 'v2rayN.Web'],
    preRelease: false,
    useProxy: true,
  }, { selected: false })

  assert.ok(dataCalls.includes('/api/core-updates'))
  assert.deepEqual(maintenance.updateSettings.value.checkPreReleaseCoreTypes, ['Xray', 'v2rayN.Web'])
  assert.equal(maintenance.updateSettings.value.preRelease, true)

  const legacyOnly = await createMaintenance({
    targets: [{ coreType: 'Xray', supportsPreRelease: true, selected: true }],
    preRelease: true,
  })
  assert.deepEqual(legacyOnly.maintenance.updateSettings.value.checkPreReleaseCoreTypes, [])
})

test('a supported core prerelease can be enabled and disabled independently of update selection', async () => {
  const { maintenance, requests } = await createMaintenance({
    targets: [{ coreType: 'Xray', supportsPreRelease: true, selected: true }],
    checkPreReleaseCoreTypes: [],
    geoFilesSelected: false,
    useProxy: true,
  })

  maintenance.maintenancePageActions.setPreReleaseTarget('Xray', true)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests).checkPreReleaseCoreTypes, ['Xray'])
  assert.deepEqual(savedSettings(requests).selectedCoreTypes, ['Xray'])

  maintenance.maintenancePageActions.setPreReleaseTarget('Xray', false)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests).checkPreReleaseCoreTypes, [])
  assert.deepEqual(savedSettings(requests).selectedCoreTypes, ['Xray'])
})

test('v2rayN.Web prerelease toggles independently and supplies only the legacy compatibility value', async () => {
  const { maintenance, requests } = await createMaintenance({
    targets: [{ coreType: 'Xray', supportsPreRelease: true, selected: false }],
    checkPreReleaseCoreTypes: ['Xray'],
    geoFilesSelected: false,
    useProxy: false,
  }, { selected: false })

  maintenance.maintenancePageActions.setPreReleaseTarget('v2rayN.Web', true)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests).checkPreReleaseCoreTypes, ['Xray', 'v2rayN.Web'])
  assert.equal(savedSettings(requests).preRelease, true)

  maintenance.maintenancePageActions.setPreReleaseTarget('v2rayN.Web', false)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests).checkPreReleaseCoreTypes, ['Xray'])
  assert.equal(savedSettings(requests).preRelease, false)
})

test('saving keeps selected targets and prerelease targets separate and excludes unsupported targets', async () => {
  const { maintenance, requests } = await createMaintenance({
    targets: [
      { coreType: 'Xray', supportsPreRelease: true, selected: true },
      { coreType: 'sing_box', supportsPreRelease: false, selected: true },
    ],
    checkPreReleaseCoreTypes: ['Xray', 'sing_box', 'GeoFiles', 'unknown'],
    geoFilesSelected: true,
    useProxy: true,
  }, { selected: true })

  maintenance.updateSettings.value.targets.find((target) => target.coreType === 'Xray').selected = false
  maintenance.maintenancePageActions.setPreReleaseTarget('Xray', false)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests), {
    selectedCoreTypes: ['sing_box', 'GeoFiles', 'v2rayN.Web'],
    checkPreReleaseCoreTypes: [],
    preRelease: false,
    useProxy: true,
  })

  maintenance.maintenancePageActions.setPreReleaseTarget('Xray', true)
  await maintenance.maintenancePageActions.saveUpdateSettings()
  assert.deepEqual(savedSettings(requests).selectedCoreTypes, ['sing_box', 'GeoFiles', 'v2rayN.Web'])
  assert.deepEqual(savedSettings(requests).checkPreReleaseCoreTypes, ['Xray'])
})

test('the Maintenance UI shows per-target prerelease controls only for supported targets', async () => {
  const page = await readFile(path.join(root, 'Src/Components/Pages/MaintenancePage.vue'), 'utf8')
  assert.match(page, /v-if="target\.supportsPreRelease"[\s\S]*?actions\.setPreReleaseTarget\(target\.coreType, \$event\)/)
  assert.match(page, /v-if="state\.updateSettings\.webTarget"[\s\S]*?setPreReleaseTarget\('v2rayN\.Web', \$event\)/)
  assert.doesNotMatch(page, /v-model="state\.updateSettings\.preRelease"/)
})
