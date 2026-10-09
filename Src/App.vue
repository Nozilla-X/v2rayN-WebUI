<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from './Components/AppHeader.vue'
import AppShell from './Components/Shell/AppShell.vue'
import ModalHost from './Components/Shell/ModalHost.vue'
import SessionScreen from './Features/Session/SessionScreen.vue'
import NodeContextMenu from './Features/Profiles/NodeContextMenu.vue'
import { useNodeActions } from './Features/Profiles/useNodeActions'
import { useFeedback } from './UI/useFeedback'
import { useGlobalShortcuts } from './UI/useGlobalShortcuts'
import { useUiRequests, provideUiRequests } from './UI/useUiRequests'
import CoreStatus from './Components/CoreStatus.vue'
import ToastViewport from './Components/ToastViewport.vue'
import DnsPage from './Components/Pages/DnsPage.vue'
import LogsPage from './Components/Pages/LogsPage.vue'
import MaintenancePage from './Components/Pages/MaintenancePage.vue'
import NodesPage from './Components/Pages/NodesPage.vue'
import RoutingPage from './Components/Pages/RoutingPage.vue'
import SettingsPage from './Components/Pages/SettingsPage.vue'
import SubscriptionsPage from './Components/Pages/SubscriptionsPage.vue'
import TemplatesPage from './Components/Pages/TemplatesPage.vue'
import { useApi } from './Composables/useApi'
import { useDns } from './Composables/useDns'
import { useEvents } from './Composables/useEvents'
import { useLogs } from './Composables/useLogs'
import { useMaintenance } from './Composables/useMaintenance'
import { useProfiles } from './Composables/useProfiles'
import { useRouting } from './Composables/useRouting'
import { useRuntime } from './Composables/useRuntime'
import { useSession } from './Composables/useSession'
import { useSettings } from './Composables/useSettings'
import { useSubscriptions } from './Composables/useSubscriptions'
import { useTemplates } from './Composables/useTemplates'
import { useTheme } from './Composables/useTheme'
import { readStoredValue, writeStoredValue } from './Composables/browserStorage'
import type { Dict } from './Composables/types'
import { useBackend } from './Composables/useBackend'
import { normalizeApiBase, networkFailureKey } from './Composables/apiEndpoint'

const { t, locale } = useI18n()
const theme = useTheme()
const backend = useBackend()
// Old unscoped tokens have no trustworthy Backend identity; require a fresh login.
try { localStorage.removeItem('v2rayn-web-token') } catch { /* Storage may be blocked. */ }
const sessionToken = ref(backend.isSameOrigin() ? readStoredValue(backend.storageKey()) || '' : '')
const connectionTesting = ref(false)
let connectionGeneration = 0
const authenticated = ref(false)
const loading = ref(false)
const activePage = ref('nodes')
const showCorePanel = ref(false)
const contextMenu = ref<Dict | null>(null)
const feedback = useFeedback(t, translateKey)
const { toasts, activeConfirmation, confirmDestructive, resolveConfirmation, dismissToast, showNotice, showError } = feedback
const uiRequests = useUiRequests(confirmDestructive)
provideUiRequests(uiRequests)
const logsPaused = ref(false)
const subscriptionProgress = ref<Record<string, string>>({})

const navItems = [
  { id: 'nodes', key: 'nav.nodes', icon: 'grid' },
  { id: 'subscriptions', key: 'nav.subscriptions', icon: 'refresh' },
  { id: 'routing', key: 'nav.routing', icon: 'route' },
  { id: 'dns', key: 'nav.dns', icon: 'dns' },
  { id: 'settings', key: 'nav.settings', icon: 'settings' },
  { id: 'templates', key: 'nav.templates', icon: 'list' },
  { id: 'maintenance', key: 'nav.maintenance', icon: 'download' },
  { id: 'logs', key: 'nav.logs', icon: 'logs' },
]

function translateKey(key?: string | null): string {
  if (!key) return t('common.operationDone')
  const translated = t(key)
  return translated === key ? key : translated
}

let clearSession = () => {}
const api = uiRequests.decorate(useApi({ getToken: () => sessionToken.value, getBase: () => backend.base.value, onUnauthorized: () => clearSession(), translateKey }))
const runtime = useRuntime({ ...api, showNotice, showError })
const profiles = useProfiles({
  ...api, t, showNotice, showError, confirm: confirmDestructive,
  loadStatus: runtime.loadStatus, loadOperations: runtime.loadOperations,
  busy: runtime.busy, operations: runtime.operations, contextMenu,
})
const subscriptions = useSubscriptions({
  ...api, t, locale, showNotice, showError, confirm: confirmDestructive,
  loadOperations: runtime.loadOperations, loadGroups: profiles.loadGroups, loadProfiles: profiles.loadProfiles,
  selectedGroup: profiles.selectedGroup, groups: profiles.groups,
})
const routing = useRouting({ ...api, t, showNotice, showError, confirm: confirmDestructive, loadStatus: runtime.loadStatus })
const dns = useDns({ ...api, t, showNotice, showError })
const settings = useSettings({ ...api, t, showNotice, showError, loadStatus: runtime.loadStatus, coreTypes: profiles.coreTypes, routingForm: routing.routingForm, routingOptions: routing.routingOptions })
const templates = useTemplates({ ...api, showNotice, showError })
let clearRealtimeLogQueue = (_generation?: number) => {}
const maintenance = useMaintenance({
  ...api, t, translateKey, showNotice, showError, confirm: confirmDestructive, token: sessionToken,
  status: runtime.status, operations: runtime.operations, loadOperations: runtime.loadOperations, loadProfiles: profiles.loadProfiles,
})
const logs = useLogs({ ...api, t, showNotice, showError, confirm: confirmDestructive, clearRealtimeQueue: (generation) => clearRealtimeLogQueue(generation) })
const events = useEvents({
  token: sessionToken, activePage, status: runtime.status,
  logs: logs.logs, logTotal: logs.logTotal, logPage: logs.logPage, logPageSize: logs.logPageSize,
  logsPaused,
  onSubscriptionProgress: progress => {
    const id = String(progress.subscriptionId || '')
    if (id && !subscriptions.subscriptions.value.some(item => item.id === id)) return
    subscriptionProgress.value = { ...subscriptionProgress.value, [id]: String(progress.rawLog || '').slice(0, 1000) }
  },
  request: api.request, resolveUrl: api.resolveUrl, t, showNotice, matchesLogFilter: logs.matchesLogFilter,
  networkFailureMessage: () => t(networkFailureKey(backend.base.value)),
  loadGroups: profiles.loadGroups, loadProfiles: profiles.loadProfiles, loadSubscriptions: subscriptions.loadSubscriptions,
  loadStatus: runtime.loadStatus, loadRouting: routing.loadRouting, loadOperations: runtime.loadOperations,
  onCoreUpdateProgress: maintenance.recordCoreUpdateProgress,
  onCoreUpdateBatchComplete: maintenance.notifyCoreUpdateBatchComplete,
  onGeoUpdateComplete: maintenance.notifyGeoUpdateComplete,
  onSpeedTestResult: profiles.nodesPageActions.applySpeedTestResult,
  onLogsCleared: logs.clearLogsState,
})
clearRealtimeLogQueue = events.clearPendingLogQueue

async function loadPageData() {
  if (activePage.value === 'routing') await routing.loadRouting()
  if (activePage.value === 'dns') await dns.loadDns()
  if (activePage.value === 'settings') await settings.loadSettings()
  if (activePage.value === 'templates') await templates.loadTemplates()
  if (activePage.value === 'maintenance') await maintenance.loadMaintenance()
  if (activePage.value === 'logs') await logs.loadLogs()
}

async function loadConnectedData() {
  await profiles.loadEditorOptions()
  await Promise.all([settings.loadSettings(), routing.loadRouting(), loadPageData()])
  await logs.loadLogs()
}

const session = useSession({
  token: sessionToken, authenticated, loading, request: api.request, publicRequest: api.publicRequest, storageKey: backend.storageKey, t, showNotice, showError,
  closeEvents: events.resetEvents, openEvents: events.openEvents,
  refreshData: async () => {
    await profiles.loadGroups()
    await Promise.all([runtime.loadStatus(), profiles.loadProfiles(), subscriptions.loadSubscriptions()])
  },
  loadConnectedData,
  resetSessionData: () => {
    api.cancelPendingRequests()
    uiRequests.reset()
    logsPaused.value = false
    subscriptionProgress.value = {}
    runtime.reset()
    profiles.reset()
    subscriptions.reset()
    routing.reset()
    dns.reset()
    settings.reset()
    templates.reset()
    maintenance.reset()
    logs.reset()
    contextMenu.value = null
    showCorePanel.value = false
    feedback.reset()
    activePage.value = 'nodes'
  },
  loadProfiles: profiles.loadProfiles,
})
clearSession = session.clearSession

function applyBackend(): boolean {
  backend.error.value = ''
  try {
    const normalized = normalizeApiBase(backend.draft.value)
    if (normalized !== backend.base.value) {
      const revokeOldSession = api.captureSessionRevocation()
      connectionGeneration += 1
      connectionTesting.value = false
      session.clearSession() // Close SSE and abort *all* requests before changing the URL.
      backend.setBase(normalized)
      void revokeOldSession()
      session.setupStatusReady.value = true
    } else backend.draft.value = normalized
    return true
  } catch { backend.error.value = t('backend.invalidEndpoint'); return false }
}

async function testConnection() {
  if (!applyBackend() || connectionTesting.value) return
  const generation = ++connectionGeneration
  connectionTesting.value = true
  try {
    const { response, payload } = await api.publicRequest('/api/health', { signal: AbortSignal.timeout(10000) })
    if (!response.ok || payload?.status !== 'ok') throw new Error(t('backend.notApi'))
    if (generation !== connectionGeneration) return
    backend.remember()
    await session.loadSetupStatus()
    if (generation === connectionGeneration) showNotice(t('backend.reachable'))
  } catch (error) {
    if (generation === connectionGeneration) showError(error)
  } finally {
    if (generation === connectionGeneration) connectionTesting.value = false
  }
}

async function loginToBackend() {
  const key = session.managementKeyDraft.value
  if (applyBackend()) {
    const generation = connectionGeneration
    const address = backend.base.value
    session.managementKeyDraft.value = key
    await session.login()
    if (generation === connectionGeneration && address === backend.base.value && authenticated.value && sessionToken.value) backend.remember(address)
  }
}

async function configureAndRemember() {
  const generation = connectionGeneration
  const address = backend.base.value
  await session.configureManagementKey()
  if (generation === connectionGeneration && address === backend.base.value && authenticated.value && sessionToken.value) backend.remember(address)
}

const {
  managementKeyDraft, setupStatusReady, setupRequired, setupAllowedFromRequest,
  setupKey, setupConfirmKey, setupSubmitting, setupError,
  configureManagementKey, refreshBase, disconnect,
} = session
const { activateRoute } = routing

const currentProfile = computed<Dict | null>(() => {
  const runtimeStatus = runtime.status.value
  const runningId = runtimeStatus?.runningProfileId
  const hasRuntimeProfile = ['starting', 'running', 'stopping', 'restarting', 'faulted'].includes(runtimeStatus?.runtimeState)
  if (hasRuntimeProfile && runningId) {
    return profiles.profiles.value.find((profile) => profile.indexId === runningId)
      || { remarks: runtimeStatus.runningProfileName || runningId }
  }
  return profiles.profiles.value.find((profile) => profile.isCurrent) || null
})
const brandIconMode = computed(() => runtime.status.value?.coreRunning ? 'proxy' : 'off')
const brandIconSrc = computed(() => ({ proxy: './NotifyIcon2.ico', off: './NotifyIcon1.ico' })[brandIconMode.value])
const brandIconTitle = computed(() => t(`brandState.${brandIconMode.value}`))
watch(brandIconSrc, (src) => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (favicon) favicon.href = src
}, { immediate: true })

function formatBytes(value: number | null | undefined) {
  let amount = Number(value || 0)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1 }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const headerState = reactive({ navItems, brandIconSrc, brandIconTitle, activePage, subscriptions: subscriptions.subscriptions, authenticated, locale, loading, themePreference: theme.preference })
const headerActions = { navigate, refreshBase, disconnect, setTheme: theme.setPreference, openCorePanel: () => { showCorePanel.value = true } }
const runtimeStripState = reactive({ status: runtime.status, currentProfile, activeRoutingId: routing.activeRoutingId, routes: routing.routes, busy: runtime.busy })
const runtimeStripActions = { activateRoute, coreAction: runtime.coreAction }
const connectionStripState = runtime.connectionStripState
const connectionStripActions = { listenerDescription: runtime.listenerDescription, formatBytes }
const nodes = useNodeActions(profiles, subscriptions, settings, contextMenu, formatBytes)
const { nodesPageState, nodesPageActions } = nodes

const subscriptionsPageState = Object.assign(subscriptions.subscriptionsPageState, { operations: runtime.operations, progress: subscriptionProgress })
const subscriptionsPageActions = subscriptions.subscriptionsPageActions
const routingPageState = routing.routingPageState
const routingPageActions = routing.routingPageActions
const dnsPageState = dns.dnsPageState
const dnsPageActions = dns.dnsPageActions
const settingsPageState = settings.settingsPageState
const settingsPageActions = settings.settingsPageActions
const profileCoreTypeMappings = computed(() => settings.settings.value.coreTypes || [])
const templatesPageState = templates.templatesPageState
const templatesPageActions = templates.templatesPageActions
const maintenancePageState = maintenance.maintenancePageState
const maintenancePageActions = maintenance.maintenancePageActions
const logsPageState = Object.assign(logs.logsPageState, { livePaused: logsPaused })
const logsPageActions = {
  ...logs.logsPageActions,
  toggleLive: async () => {
    logsPaused.value = !logsPaused.value
    events.clearPendingLogQueue()
    if (!logsPaused.value) await logs.loadLogs(1)
  },
}

const profileModalState = profiles.profileModalState
const profileModalActions = profiles.profileModalActions
const importProfilesModalState = profiles.importProfilesModalState
const importProfilesModalActions = profiles.importProfilesModalActions
const subscriptionModalState = subscriptions.subscriptionModalState
const subscriptionModalActions = subscriptions.subscriptionModalActions
const routeModalState = routing.routeModalState
const routeModalActions = routing.routeModalActions
const ruleModalState = routing.ruleModalState
const ruleModalActions = routing.ruleModalActions
const exportModalState = profiles.exportModalState
const exportModalActions = profiles.exportModalActions
const modalBindings = {
  profile: { state: profileModalState, actions: profileModalActions },
  importProfiles: { state: importProfilesModalState, actions: importProfilesModalActions },
  subscription: { state: subscriptionModalState, actions: subscriptionModalActions },
  route: { state: routeModalState, actions: routeModalActions },
  rule: { state: ruleModalState, actions: ruleModalActions },
  export: { state: exportModalState, actions: exportModalActions },
}
const sessionScreenState = reactive({
  setupStatusReady, setupRequired, setupAllowedFromRequest, setupKey, setupConfirmKey, setupSubmitting, setupError, managementKeyDraft,
  backendDraft: backend.draft, backendError: backend.error, backendHistory: backend.history, connectionTesting,
})
const sessionScreenActions = { applyBackend, testConnection, loginToBackend, configureManagementKey: configureAndRemember, forgetBackendAddress: backend.forget }
const shellReady = computed(() => setupStatusReady.value && !setupRequired.value)
useGlobalShortcuts({
  activePage, contextMenu, nodes: nodes.contextActions,
  confirmationOpen: () => Boolean(activeConfirmation.value),
  cancelConfirmation: () => resolveConfirmation(false),
  modalLayers: [
    { isOpen: () => exportModalState.showExportDialog, close: () => { profiles.showExportDialog.value = false } },
    { isOpen: () => ruleModalState.showRuleForm, close: () => { ruleModalState.showRuleForm = false } },
    { isOpen: () => routing.showRouteForm.value, close: () => { routing.showRouteForm.value = false } },
    { isOpen: () => subscriptions.showSubscriptionForm.value, close: () => { subscriptions.showSubscriptionForm.value = false } },
    { isOpen: () => profiles.showImportForm.value, close: () => { profiles.showImportForm.value = false } },
    { isOpen: () => profiles.showProfileForm.value, close: () => { profiles.showProfileForm.value = false } },
    { isOpen: () => showCorePanel.value, close: () => { showCorePanel.value = false } },
  ],
})

async function navigate(page: string) {
  if (page !== activePage.value && uiRequests.dirty() && !await confirmDestructive(t('polish.discardChanges'))) return
  activePage.value = page
  contextMenu.value = null
  profiles.selectedIds.value = []
  if (window.matchMedia('(max-width: 760px)').matches) {
    await nextTick()
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
}

watch(activePage, async () => {
  if (authenticated.value) {
    try { await loadPageData() } catch (error) { showError(error) }
  }
})

watch(locale, (value) => {
  writeStoredValue('v2rayn-web-locale', value)
  document.documentElement.lang = value
}, { immediate: true })

onMounted(async () => {
  // Cross-origin and local-network permission requests require an explicit action.
  if (!backend.isSameOrigin()) { setupStatusReady.value = true; return }
  await session.loadSetupStatus()
  if (setupRequired.value || !sessionToken.value) return
  authenticated.value = true
  try {
    await refreshBase()
    if (authenticated.value) {
      events.openEvents()
      await loadConnectedData()
    }
  } catch (error) { showError(error) }
})

</script>

<template>
  <AppShell :ready="shellReady" :authenticated="authenticated" @dismiss-context="contextMenu = null">
    <template #setup><SessionScreen :state="sessionScreenState" :actions="sessionScreenActions" /></template>
    <template #header><AppHeader :state="headerState" :actions="headerActions" /></template>
    <template #login><SessionScreen :state="sessionScreenState" :actions="sessionScreenActions" /></template>
    <template #status>
      <CoreStatus :runtime-state="runtimeStripState" :runtime-actions="runtimeStripActions" :connection-state="connectionStripState" :connection-actions="connectionStripActions" :open="showCorePanel" @close="showCorePanel = false" />
    </template>
    <NodesPage v-if="activePage === 'nodes'" :state="nodesPageState" :actions="nodesPageActions" />
    <SubscriptionsPage v-else-if="activePage === 'subscriptions'" :state="subscriptionsPageState" :actions="subscriptionsPageActions" />
    <RoutingPage v-else-if="activePage === 'routing'" :state="routingPageState" :actions="routingPageActions" />
    <DnsPage v-else-if="activePage === 'dns'" :state="dnsPageState" :actions="dnsPageActions" />
    <SettingsPage v-else-if="activePage === 'settings'" :state="settingsPageState" :actions="settingsPageActions" />
    <TemplatesPage v-else-if="activePage === 'templates'" :state="templatesPageState" :actions="templatesPageActions" />
    <MaintenancePage v-else-if="activePage === 'maintenance'" :state="maintenancePageState" :actions="maintenancePageActions" />
    <LogsPage v-else-if="activePage === 'logs'" :state="logsPageState" :actions="logsPageActions" />
    <template #overlays>
      <NodeContextMenu v-model="contextMenu" :state="nodesPageState" :actions="nodesPageActions" :context-actions="nodes.contextActions" />
      <ModalHost :bindings="modalBindings" :core-type-mappings="profileCoreTypeMappings" :confirmation="activeConfirmation" @resolve-confirmation="resolveConfirmation" />
    </template>
    <template #feedback><ToastViewport :toasts="toasts" :close-label="t('common.close')" @dismiss="dismissToast" /></template>
  </AppShell>
</template>
