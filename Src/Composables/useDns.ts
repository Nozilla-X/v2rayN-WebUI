import { reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'

export function useDns(options: ApiServices & { t: Translate; showNotice: Notice; showError: ErrorHandler }) {
  const t = options.t
  const simpleDnsForm = ref<Dict>({})
  const simpleDnsAdvancedRaw = ref('{}')
  const initialSimpleDns = ref<Dict>({})
  const dnsProfiles = ref<Dict[]>([])
  const dnsOptions = ref<Dict>({})

  async function loadDns() {
    const [simple, profilesResult, editorOptions] = await Promise.all([
      options.data('/api/settings/dns/simple'),
      options.data('/api/settings/dns/profiles'),
      options.data('/api/settings/dns/editor-options'),
    ])
    simpleDnsForm.value = { ...(simple || {}) }
    initialSimpleDns.value = { ...(simple || {}) }
    simpleDnsAdvancedRaw.value = JSON.stringify(simple || {}, null, 2)
    dnsOptions.value = editorOptions || {}
    dnsProfiles.value = (profilesResult || []).filter((profile: Dict) =>
      dnsOptions.value.coreTypes?.some((core: string) => core.toLowerCase() === String(profile.coreType).toLowerCase()))
  }

  async function saveSimpleDns() {
    try {
      const advanced = JSON.parse(simpleDnsAdvancedRaw.value || '{}')
      const changedFields = Object.fromEntries(Object.entries(simpleDnsForm.value).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(initialSimpleDns.value[key])))
      const payload = { ...advanced, ...changedFields }
      const result = await options.request('/api/settings/dns/simple', { method: 'PUT', body: payload })
      initialSimpleDns.value = { ...payload }
      simpleDnsForm.value = { ...payload }
      simpleDnsAdvancedRaw.value = JSON.stringify(payload, null, 2)
      options.showNotice(options.operationMessage(result))
    } catch (error) {
      if (error instanceof SyntaxError) options.showNotice(t('common.invalidJson'), 'error')
      else options.showError(error)
    }
  }

  async function saveDnsProfile(profile: Dict) {
    try {
      const result = await options.request(`/api/settings/dns/profiles/${encodeURIComponent(options.coreTypeRoute(profile.coreType))}`, {
        method: 'PUT',
        body: {
          remarks: profile.remarks, enabled: profile.enabled, useSystemHosts: profile.useSystemHosts,
          normalDNS: profile.normalDNS, tunDNS: profile.tunDNS, domainStrategy4Freedom: profile.domainStrategy4Freedom,
          domainDNSAddress: profile.domainDNSAddress,
        },
      })
      options.showNotice(options.operationMessage(result))
      await loadDns()
    } catch (error) { options.showError(error) }
  }

  async function importDefaultDns(profile: Dict) {
    try {
      const defaults = await options.data('/api/settings/dns/defaults') || []
      const coreType = options.coreTypeRoute(profile.coreType).replace('-', '_')
      const selected = defaults.find((item: Dict) => String(item.coreType).toLowerCase() === coreType.toLowerCase())
      if (!selected) return options.showNotice(t('dns.coreProfileUnavailable'), 'error')
      profile.normalDNS = selected.normalDNS
      profile.tunDNS = selected.tunDNS
    } catch (error) { options.showError(error) }
  }

  const dnsPageState = reactive({ simpleDnsForm, simpleDnsAdvancedRaw, dnsProfiles, dnsOptions })

  return { simpleDnsForm, simpleDnsAdvancedRaw, dnsProfiles, loadDns, dnsPageState, dnsPageActions: { loadDns, saveSimpleDns, saveDnsProfile, importDefaultDns } }
}
