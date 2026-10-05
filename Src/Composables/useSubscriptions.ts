import { reactive, ref, type Ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'
import { nullableNumber } from './settingsPayloads.js'

export function useSubscriptions(options: ApiServices & {
  t: Translate
  locale: Ref<string>
  showNotice: Notice
  showError: ErrorHandler
  confirm: (message: string) => Promise<boolean>
  loadOperations: () => Promise<void>
  loadGroups: () => Promise<void>
  loadProfiles: () => Promise<void>
  selectedGroup: Ref<string>
  groups: Ref<Dict[]>
}) {
  const t = options.t
  const subscriptions = ref<Dict[]>([])
  const subscriptionUseProxy = ref(false)
  const subscriptionForm = ref<Dict>({})
  const profileOptions = ref<Dict[]>([])
  const coreTypes = ref<string[]>([])
  const convertTargets = ref<string[]>([])
  const showSubscriptionForm = ref(false)
  const editingSubscriptionId = ref('')

  async function loadSubscriptions() {
    subscriptions.value = await options.data('/api/subscriptions') || []
  }

  async function loadEditorOptions() {
    const result = await options.data('/api/editor-options')
    coreTypes.value = result?.subscriptions?.customCoreTypes || []
    convertTargets.value = result?.subscriptions?.convertTargets || []
  }

  function subscriptionUpdateMessageKey(subscriptionId: string | null, useProxy: boolean): string {
    const scope = subscriptionId ? 'Group' : 'All'
    return `subscriptions.update${scope}${useProxy ? 'ViaProxy' : ''}`
  }

  async function openAddSubscription() {
    try {
      await Promise.all([loadEditorOptions(), loadProfileOptions()])
    } catch (error) { options.showError(error); return }
    editingSubscriptionId.value = ''
    subscriptionForm.value = {
      remarks: '', url: '', moreUrl: '', enabled: true, userAgent: '', requestHeaders: '', filter: '',
      autoUpdateInterval: 0, convertTarget: '', memo: '', sort: 0, prevProfile: '', nextProfile: '', preSocksPort: null, customCoreType: null,
    }
    showSubscriptionForm.value = true
  }

  async function openEditSubscription(item: Dict) {
    try {
      await Promise.all([loadEditorOptions(), loadProfileOptions()])
    } catch (error) { options.showError(error); return }
    editingSubscriptionId.value = item.id
    subscriptionForm.value = {
      ...item,
      customCoreType: item.customCoreType ?? null,
      convertTarget: item.convertTarget ?? '',
    }
    showSubscriptionForm.value = true
  }

  async function loadProfileOptions() {
    const groupIds = [...new Set(['', ...options.groups.value.map((group) => group.id).filter(Boolean)])]
    const lists = await Promise.all(groupIds.map((subscriptionId) => options.data(subscriptionId ? options.queryPath('/api/profiles', { subscriptionId }) : '/api/profiles?subscriptionId=')))
    profileOptions.value = [...new Map(lists.flat().map((item: Dict) => [item.indexId, item])).values()]
  }

  async function saveSubscription() {
    try {
      const preSocksPort = nullableNumber(subscriptionForm.value.preSocksPort)
      const body = {
        ...subscriptionForm.value,
        autoUpdateInterval: Number(subscriptionForm.value.autoUpdateInterval ?? 0),
        sort: Number(subscriptionForm.value.sort ?? 0),
        preSocksPort,
      }
      const editingId = editingSubscriptionId.value
      const isEditing = Boolean(editingId)
      const result = await options.request(
        isEditing ? `/api/subscriptions/${encodeURIComponent(editingId)}` : '/api/subscriptions',
        { method: isEditing ? 'PUT' : 'POST', body },
      )
      showSubscriptionForm.value = false
      options.showNotice(options.operationMessage(result, isEditing ? 'subscriptions.saved' : 'subscriptions.added'))
      await Promise.all([loadSubscriptions(), options.loadGroups()])
    } catch (error) { options.showError(error) }
  }

  async function deleteSubscription(item: Dict) {
    if (!await options.confirm(t('subscriptions.deleteConfirm', { name: item.remarks }))) return
    try {
      const result = await options.request(`/api/subscriptions/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      options.showNotice(options.operationMessage(result, 'subscriptions.deleted'))
      await loadSubscriptions()
      await options.loadGroups()
      await options.loadProfiles()
    } catch (error) { options.showError(error) }
  }

  async function updateSubscription(id: string, useProxy = subscriptionUseProxy.value) {
    try {
      const result = await options.request(`/api/subscriptions/${encodeURIComponent(id)}/update?useProxy=${useProxy}`, { method: 'POST' })
      options.showNotice(options.operationMessage(result, 'subscriptions.updateStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function updateSubscriptions(subscriptionId: string | null, useProxy = subscriptionUseProxy.value) {
    try {
      const result = await options.request('/api/subscriptions/update', { method: 'POST', body: { subscriptionId, useProxy } })
      options.showNotice(options.operationMessage(result, 'subscriptions.updateStarted'))
      await options.loadOperations()
    } catch (error) { options.showError(error) }
  }

  async function shareSubscription(item: Dict) {
    try {
      const share = await options.data(`/api/subscriptions/${encodeURIComponent(item.id)}/share`)
      await navigator.clipboard.writeText(share.url)
      options.showNotice(t('subscriptions.shareCopied'))
    } catch (error) { options.showError(error) }
  }

  function formatDate(epochSeconds: number) {
    if (!epochSeconds) return '—'
    return new Intl.DateTimeFormat(options.locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(epochSeconds * 1000))
  }

  function reset() {
    subscriptions.value = []
    subscriptionForm.value = {}
    profileOptions.value = []
    coreTypes.value = []
    convertTargets.value = []
    showSubscriptionForm.value = false
    editingSubscriptionId.value = ''
  }

  const subscriptionsPageState = reactive({ subscriptions, subscriptionUseProxy, selectedGroup: options.selectedGroup })
  const subscriptionModalState = reactive({ showSubscriptionForm, subscriptionForm, editingSubscriptionId, coreTypes, convertTargets, profileOptions })

  return {
    subscriptions, subscriptionUseProxy, showSubscriptionForm, loadSubscriptions, loadEditorOptions, subscriptionsPageState, subscriptionModalState,
    subscriptionUpdateMessageKey, reset,
    subscriptionsPageActions: { formatDate, subscriptionUpdateMessageKey, updateSubscriptions, openAddSubscription, updateSubscription, shareSubscription, openEditSubscription, deleteSubscription },
    subscriptionModalActions: { saveSubscription },
  }
}
