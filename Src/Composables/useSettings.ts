import { reactive, ref, type Ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice } from './types'
import type { Translate } from './types'
import { buildApplicationSettingsBody, buildCoreSettingsBody, buildSettingsApplyBody, buildSpeedSettingsBody } from './settingsPayloads.js'

export function useSettings(options: ApiServices & {
  t: Translate
  showNotice: Notice
  showError: ErrorHandler
  loadStatus: () => Promise<void>
  coreTypes: string[]
  routingForm: Ref<Dict>
  routingOptions: Ref<Dict>
}) {
  const settings = ref<Dict>({})
  const inboundForm = ref<Dict>({})
  const coreForm = ref<Dict>({})
  const appForm = ref<Dict>({})
  const speedForm = ref<Dict>({})

  async function loadSettings() {
    settings.value = await options.data('/api/settings') || {}
    options.routingOptions.value = settings.value.options || {}
    settings.value.coreTypes = (settings.value.coreTypes || []).map((mapping: Dict) => ({
      ...mapping,
      coreType: options.canonicalCode(mapping.coreType, options.coreTypes),
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
      const result = await options.request('/api/settings/inbound', {
        method: 'PUT', body: {
          localPort: Number(inboundForm.value.localPort), secondLocalPortEnabled: inboundForm.value.secondLocalPortEnabled,
          udpEnabled: inboundForm.value.udpEnabled, sniffingEnabled: inboundForm.value.sniffingEnabled,
          destOverride: inboundForm.value.destOverride || [], routeOnly: inboundForm.value.routeOnly,
          allowLANConn: inboundForm.value.allowLANConn, newPort4LAN: inboundForm.value.newPort4LAN,
          user: inboundForm.value.user, pass: inboundForm.value.pass,
        },
      })
      options.showNotice(options.operationMessage(result))
      await options.loadStatus()
    } catch (error) { options.showError(error) }
  }

  async function saveCoreSettings() {
    try {
      const result = await options.request('/api/settings/core', {
        method: 'PUT', body: buildCoreSettingsBody(coreForm.value),
      })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveAppSettings() {
    try {
      const result = await options.request('/api/settings/application', { method: 'PUT', body: buildApplicationSettingsBody(appForm.value) })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveSpeedSettings() {
    try {
      const result = await options.request('/api/settings/speedtest', { method: 'PUT', body: buildSpeedSettingsBody(speedForm.value) })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveCoreTypes() {
    try {
      const result = await options.request('/api/settings/core-types', { method: 'PUT', body: { mappings: settings.value.coreTypes || [] } })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  async function saveAllSettings() {
    try {
      const body = buildSettingsApplyBody({
        inbound: inboundForm.value,
        core: coreForm.value,
        app: appForm.value,
        speed: speedForm.value,
        coreTypes: settings.value.coreTypes || [],
        routing: options.routingForm.value,
      })
      const result = await options.request('/api/settings/apply', { method: 'PUT', body })
      await options.loadStatus()
      options.showNotice(options.operationMessage(result, 'settings.allSaved'))
      return { completed: ['settings.allSaved'], failed: null }
    } catch (error) {
      options.showError(error)
      return { completed: [], failed: 'settings.allSaved' }
    }
  }

  const settingsPageState = reactive({ inboundForm, coreForm, appForm, speedForm, settings, coreTypes: options.coreTypes })

  return { settings, inboundForm, coreForm, appForm, speedForm, loadSettings, settingsPageState, settingsPageActions: { saveInbound, saveCoreSettings, saveAppSettings, saveSpeedSettings, saveCoreTypes, saveAllSettings, toggleDestOverride } }
}
