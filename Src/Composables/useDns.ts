import { reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'

export function useDns(options: ApiServices & { t: Translate; showNotice: Notice; showError: ErrorHandler }) {
  const t = options.t
  const simpleDnsForm = ref<Dict>({})
  const simpleDnsAdvancedRaw = ref('{}')
  const initialSimpleDns = ref<Dict>({})
  const dnsProfiles = ref<Dict[]>([])

  async function loadDns() {
    const [simple, profilesResult] = await Promise.all([
      options.data('/api/settings/dns/simple'),
      options.data('/api/settings/dns/profiles'),
    ])
    simpleDnsForm.value = { ...(simple || {}) }
    initialSimpleDns.value = { ...(simple || {}) }
    simpleDnsAdvancedRaw.value = JSON.stringify(simple || {}, null, 2)
    dnsProfiles.value = (profilesResult || []).filter((profile: Dict) => ['Xray', 'sing_box', 'sing-box'].includes(String(profile.coreType)))
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
          normalDNS: profile.normalDNS, domainStrategy4Freedom: profile.domainStrategy4Freedom,
          domainDNSAddress: profile.domainDNSAddress,
        },
      })
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  const dnsPageState = reactive({ simpleDnsForm, simpleDnsAdvancedRaw, dnsProfiles })

  return { simpleDnsForm, simpleDnsAdvancedRaw, dnsProfiles, loadDns, dnsPageState, dnsPageActions: { loadDns, saveSimpleDns, saveDnsProfile } }
}
