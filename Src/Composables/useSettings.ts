import { reactive, ref, type Ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice } from './types'
import type { Translate } from './types'
import { buildApplicationSettingsBody, buildCoreSettingsBody, buildSettingsApplyBody, buildSpeedSettingsBody } from './settingsPayloads.js'
import { saveSettingsAndReload } from './settingsSaveFlow.js'

export function useSettings(options: ApiServices & {
  t: Translate
  showNotice: Notice
  showError: ErrorHandler
  loadStatus: () => Promise<void>
  coreTypes: Ref<string[]>
  routingForm: Ref<Dict>
  routingOptions: Ref<Dict>
}) {
  const settings = ref<Dict>({})
  const inboundForm = ref<Dict>({})
  const coreForm = ref<Dict>({})
  const appForm = ref<Dict>({})
  const speedForm = ref<Dict>({})
  const saving = ref(false)
  let loadGeneration = 0

  async function loadSettings() {
    const generation = ++loadGeneration
    const loaded = await options.data('/api/settings') || {}
    if (generation !== loadGeneration) return
    settings.value = loaded
    options.routingOptions.value = settings.value.options || {}
    settings.value.coreTypes = (settings.value.coreTypes || []).map((mapping: Dict) => ({
      ...mapping,
      coreType: options.canonicalCode(mapping.coreType, options.coreTypes.value),
    }))
    const inb = settings.value.inbound || {}
    inboundForm.value = { ...inb, destOverride: inb.destOverride || [] }
    const core = settings.value.core || {}
    coreForm.value = {
      ...core,
      fragmentLengthsText: (core.fragmentLengths || []).join('\n'),
      fragmentDelaysText: (core.fragmentDelays || []).join('\n'),
    }
    appForm.value = { ...(settings.value.app || {}) }
    speedForm.value = { ...(settings.value.speedTest || {}) }
    options.routingForm.value = {
      domainStrategy: settings.value.domainStrategy || '',
      domainStrategy4Singbox: settings.value.domainStrategy4Singbox || '',
    }
  }

  function toggleDestOverride(protocol: string, checked: boolean) {
    const selected = new Set<string>(inboundForm.value.destOverride || [])
    if (checked) selected.add(protocol)
    else selected.delete(protocol)
    inboundForm.value.destOverride = [...selected]
  }

  async function saveInbound() {
    try {
      const result = await saveSettingsAndReload(options.request, '/api/settings/inbound', {
        method: 'PUT', body: {
          localPort: Number(inboundForm.value.localPort), secondLocalPortEnabled: inboundForm.value.secondLocalPortEnabled,
          udpEnabled: inboundForm.value.udpEnabled, sniffingEnabled: inboundForm.value.sniffingEnabled,
          destOverride: inboundForm.value.destOverride || [], routeOnly: inboundForm.value.routeOnly,
          allowLANConn: inboundForm.value.allowLANConn, newPort4LAN: inboundForm.value.newPort4LAN,
          user: inboundForm.value.user, pass: inboundForm.value.pass,
        },
      }, loadSettings, options.loadStatus)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveCoreSettings() {
    try {
      const result = await saveSettingsAndReload(options.request, '/api/settings/core', {
        method: 'PUT', body: buildCoreSettingsBody(coreForm.value),
      }, loadSettings)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveAppSettings() {
    try {
      const result = await saveSettingsAndReload(options.request, '/api/settings/application', { method: 'PUT', body: buildApplicationSettingsBody(appForm.value) }, loadSettings)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveSpeedSettings() {
    try {
      const result = await saveSettingsAndReload(options.request, '/api/settings/speedtest', { method: 'PUT', body: buildSpeedSettingsBody(speedForm.value) }, loadSettings)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveCoreTypes() {
    try {
      const result = await saveSettingsAndReload(options.request, '/api/settings/core-types', { method: 'PUT', body: { mappings: settings.value.coreTypes || [] } }, loadSettings)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveAllSettings() {
    if (saving.value) return { completed: [], failed: null }
    saving.value = true
    // A GET started before this save must not restore an older snapshot.
    loadGeneration += 1
    try {
      const body = buildSettingsApplyBody({
        inbound: inboundForm.value,
        core: coreForm.value,
        app: appForm.value,
        speed: speedForm.value,
        coreTypes: settings.value.coreTypes || [],
        routing: options.routingForm.value,
      })
      const result = await saveSettingsAndReload(options.request, '/api/settings/apply', { method: 'PUT', body }, loadSettings, options.loadStatus)
      options.showNotice(options.operationMessage(result, 'settings.allSaved'))
      return { completed: ['settings.allSaved'], failed: null }
    } catch (error) {
      options.showError(error)
      return { completed: [], failed: 'settings.allSaved' }
    } finally {
      saving.value = false
    }
  }

  const settingsPageState = reactive({ inboundForm, coreForm, appForm, speedForm, settings, saving, coreTypes: options.coreTypes })

  function reset() {
    loadGeneration += 1
    settings.value = {}
    inboundForm.value = {}
    coreForm.value = {}
    appForm.value = {}
    speedForm.value = {}
  }

  return { settings, inboundForm, coreForm, appForm, speedForm, loadSettings, settingsPageState, reset, settingsPageActions: { saveInbound, saveCoreSettings, saveAppSettings, saveSpeedSettings, saveCoreTypes, saveAllSettings, toggleDestOverride } }
}
