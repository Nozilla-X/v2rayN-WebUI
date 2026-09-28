<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppHeader from './Components/AppHeader.vue'
import ConnectionStrip from './Components/ConnectionStrip.vue'
import ConfirmDialog from './Components/Modals/ConfirmDialog.vue'
import FlyoutMenu from './Components/FlyoutMenu.vue'
import ToastViewport from './Components/ToastViewport.vue'
import RuntimeStrip from './Components/RuntimeStrip.vue'
import DnsPage from './Components/Pages/DnsPage.vue'
import LogsPage from './Components/Pages/LogsPage.vue'
import MaintenancePage from './Components/Pages/MaintenancePage.vue'
import NodesPage from './Components/Pages/NodesPage.vue'
import RoutingPage from './Components/Pages/RoutingPage.vue'
import SettingsPage from './Components/Pages/SettingsPage.vue'
import SubscriptionsPage from './Components/Pages/SubscriptionsPage.vue'
import TemplatesPage from './Components/Pages/TemplatesPage.vue'
import ExportModal from './Components/Modals/ExportModal.vue'
import ImportProfilesModal from './Components/Modals/ImportProfilesModal.vue'
import ProfileModal from './Components/Modals/ProfileModal.vue'
import RouteModal from './Components/Modals/RouteModal.vue'
import RouteRuleModal from './Components/Modals/RouteRuleModal.vue'
import SubscriptionModal from './Components/Modals/SubscriptionModal.vue'
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
import type { ApiError, Dict, NoticeKind } from './Composables/types'
import { navigateMenu } from './Components/menuContext'

const { t, locale } = useI18n()
const theme = useTheme()
const sessionToken = ref(localStorage.getItem('v2rayn-web-token') || '')
const authenticated = ref(false)
const loading = ref(false)
const activePage = ref('nodes')
const contextMenu = ref<Dict | null>(null)
interface ToastEntry { id: number; message: string; kind: NoticeKind }
const toasts = ref<ToastEntry[]>([])
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()
let nextToastId = 1

interface ConfirmationRequest {
  message: string
  resolve: (confirmed: boolean) => void
}

const activeConfirmation = ref<ConfirmationRequest | null>(null)
const confirmationQueue: ConfirmationRequest[] = []
let confirmationOpen = false

function activateNextConfirmation() {
  if (confirmationOpen || !confirmationQueue.length) return
  confirmationOpen = true
  activeConfirmation.value = confirmationQueue.shift()!
}

function confirmDestructive(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmationQueue.push({ message, resolve })
    activateNextConfirmation()
  })
}

async function resolveConfirmation(confirmed: boolean) {
  const current = activeConfirmation.value
  if (!current) return
  activeConfirmation.value = null
  current.resolve(confirmed)
  await nextTick()
  confirmationOpen = false
  activateNextConfirmation()
}

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

function dismissToast(id: number) {
  const timer = toastTimers.get(id)
  if (timer) clearTimeout(timer)
  toastTimers.delete(id)
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function showNotice(message: string, kind: NoticeKind = 'success') {
  const normalized = String(message || '').trim()
  if (!normalized) return

  const duplicate = toasts.value.find((toast) => toast.kind === kind && toast.message === normalized)
  const id = duplicate?.id ?? nextToastId++
  if (duplicate) {
    const timer = toastTimers.get(id)
    if (timer) clearTimeout(timer)
  } else {
    if (toasts.value.length >= 4) dismissToast(toasts.value[0].id)
    toasts.value = [...toasts.value, { id, message: normalized, kind }]
  }

  const timeout = kind === 'error' ? 12000 : kind === 'warning' ? 9000 : 3500
  toastTimers.set(id, setTimeout(() => dismissToast(id), timeout))
}

function showError(error: unknown) {
  const issue = error as ApiError
  const baseMessage = issue.code === 'profile_group_empty'
    ? t('nodes.groupGenerationEmpty')
    : issue.messageKey ? translateKey(issue.messageKey) : issue.message || t('common.unknownError')
  const detail = (issue.data as Dict | undefined)?.detail
  const message = typeof detail === 'string' && detail.length > 0
    ? `${baseMessage}: ${detail}`
    : baseMessage
  showNotice(message, 'error')
}

let clearSession = () => {}
const api = useApi({ getToken: () => sessionToken.value, onUnauthorized: () => clearSession(), translateKey })
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
  request: api.request, t, showNotice, matchesLogFilter: logs.matchesLogFilter,
  loadGroups: profiles.loadGroups, loadProfiles: profiles.loadProfiles, loadSubscriptions: subscriptions.loadSubscriptions,
  loadStatus: runtime.loadStatus, loadRouting: routing.loadRouting, loadOperations: runtime.loadOperations,
  onCoreUpdateProgress: maintenance.recordCoreUpdateProgress,
  onCoreUpdateBatchComplete: maintenance.notifyCoreUpdateBatchComplete,
  onGeoUpdateComplete: maintenance.notifyGeoUpdateComplete,
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
  await Promise.all([settings.loadSettings(), routing.loadRouting(), loadPageData()])
  await logs.loadLogs()
}

const session = useSession({
  token: sessionToken, authenticated, loading, request: api.request, t, showNotice, showError,
  closeEvents: events.closeEvents, openEvents: events.openEvents,
  refreshData: async () => {
    await profiles.loadGroups()
    await Promise.all([runtime.loadStatus(), profiles.loadProfiles(), subscriptions.loadSubscriptions()])
  },
  loadConnectedData,
  resetSessionData: () => {
    runtime.status.value = null
    profiles.profiles.value = []
    profiles.groups.value = []
    subscriptions.subscriptions.value = []
  },
  loadProfiles: profiles.loadProfiles,
})
clearSession = session.clearSession

const {
  managementKeyDraft, setupStatusReady, setupRequired, setupAllowedFromRequest,
  setupKey, setupConfirmKey, setupSubmitting, setupError,
  login, configureManagementKey, refreshBase, disconnect,
} = session
const {
  showProfileForm, showImportForm, showExportDialog, openEditProfile,
} = profiles
const { showSubscriptionForm } = subscriptions
const { showRouteForm, activateRoute } = routing

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
const brandIconSrc = computed(() => ({ proxy: '/NotifyIcon2.ico', off: '/NotifyIcon1.ico' })[brandIconMode.value])
const brandIconTitle = computed(() => t(`brandState.${brandIconMode.value}`))
watch(brandIconSrc, (src) => {
  const favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (favicon) favicon.href = src
}, { immediate: true })
const pageTitle = computed(() => {
  const item = navItems.find((entry) => entry.id === activePage.value)
  return item ? t(item.key) : t('nav.nodes')
})

function formatBytes(value: number | null | undefined) {
  let amount = Number(value || 0)
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let unit = 0
  while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit += 1 }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

const emptyProfileExportOptions = {
  includeShareUris: false,
  base64ShareUris: false,
  includeInnerUri: false,
  includeClientConfig: false,
}

type ProfileExportOptions = Partial<typeof emptyProfileExportOptions>

async function openProfileExport(options: ProfileExportOptions, profileIds?: string[]) {
  Object.assign(profiles.exportModalState.exportOptions, emptyProfileExportOptions, options)
  const previousSelection = profiles.selectedIds.value
  if (profileIds) profiles.selectedIds.value = profileIds
  try {
    await profiles.nodesPageActions.exportSelected()
  } finally {
    if (profileIds) profiles.selectedIds.value = previousSelection
  }
}

async function copyProfileExport(options: ProfileExportOptions, profileIds?: string[]) {
  await openProfileExport(options, profileIds)
  if (!profiles.exportModalState.showExportDialog) return
  await profiles.exportModalActions.copyExport()
  profiles.exportModalState.showExportDialog = false
}

const contextMenuElement = ref<HTMLElement | null>(null)
const contextMenuPlacement = ref({ left: '-10000px', top: '-10000px' })

function positionContextMenu(menu: Dict) {
  const element = contextMenuElement.value
  if (!element) return
  const margin = 8
  const width = element.offsetWidth
  const height = element.offsetHeight
  const left = Math.max(margin, Math.min(Number(menu.x) || 0, window.innerWidth - width - margin))
  const top = Math.max(margin, Math.min(Number(menu.y) || 0, window.innerHeight - height - margin))
  contextMenuPlacement.value = { left: `${left}px`, top: `${top}px` }
}

const headerState = reactive({ navItems, brandIconSrc, brandIconTitle, activePage, subscriptions: subscriptions.subscriptions, authenticated, locale, loading, themePreference: theme.preference })
const headerActions = { navigate, refreshBase, disconnect, setTheme: theme.setPreference }
const runtimeStripState = reactive({ status: runtime.status, currentProfile, activeRoutingId: routing.activeRoutingId, routes: routing.routes, busy: runtime.busy })
const runtimeStripActions = { activateRoute, coreAction: runtime.coreAction }
const connectionStripState = runtime.connectionStripState
const connectionStripActions = { listenerDescription: runtime.listenerDescription, formatBytes }
const nodesPageState = Object.assign(profiles.nodesPageState, { subscriptions: subscriptions.subscriptions })
const nodesPageActions = {
  ...profiles.nodesPageActions,
  updateSubscriptions: subscriptions.subscriptionsPageActions.updateSubscriptions,
  subscriptionUpdateMessageKey: subscriptions.subscriptionUpdateMessageKey,
  openAddSubscription: subscriptions.subscriptionsPageActions.openAddSubscription,
  openEditSubscription: subscriptions.subscriptionsPageActions.openEditSubscription,
  shareSelected: () => openProfileExport({ includeShareUris: true }),
  shareProfile: (profileId: string) => openProfileExport({ includeShareUris: true }, [profileId]),
  exportFullConfig: () => openProfileExport({ includeClientConfig: true }),
  exportProfileConfig: (profileId: string) => openProfileExport({ includeClientConfig: true }, [profileId]),
  exportFullConfigToClipboard: () => copyProfileExport({ includeClientConfig: true }),
  exportProfileConfigToClipboard: (profileId: string) => copyProfileExport({ includeClientConfig: true }, [profileId]),
  exportShareLinksToClipboard: () => copyProfileExport({ includeShareUris: true }),
  exportShareLinksBase64: () => copyProfileExport({ base64ShareUris: true }),
  exportInnerUris: () => copyProfileExport({ includeInnerUri: true }),
  formatBytes,
}

function nodeProfileForAction(event?: Event): Dict | undefined {
  const target = event?.target
  const rowId = target instanceof Element ? target.closest<HTMLElement>('[data-profile-id]')?.dataset.profileId : undefined
  const id = rowId || nodesPageState.focusedProfileId || contextMenu.value?.profile?.indexId || profiles.selectedIds.value[0]
  return profiles.profiles.value.find((profile) => profile.indexId === id)
    || (contextMenu.value?.profile as Dict | undefined)
}

function nodeIdsForAction(event?: Event): string[] {
  if (profiles.selectedIds.value.length) return [...profiles.selectedIds.value]
  const profile = nodeProfileForAction(event)
  return profile ? [profile.indexId] : []
}

function ensureNodeSelection() {
  if (profiles.selectedIds.value.length) return true
  const profile = nodeProfileForAction()
  if (!profile) return false
  profiles.selectedIds.value = [profile.indexId]
  return true
}

function selectContextProfile() {
  const profile = nodeProfileForAction()
  if (profile) void nodesPageActions.selectProfile(profile)
}

function editContextProfile() {
  const profile = nodeProfileForAction()
  if (profile) void profiles.openEditProfile(profile)
}

function copySelectedNodes() {
  if (ensureNodeSelection()) void nodesPageActions.runProfileAction('copy')
}

function deleteSelectedNodes() {
  if (ensureNodeSelection()) void nodesPageActions.runProfileAction('delete')
}

function testSelectedNodes(action: string, profile?: Dict) {
  const ids = profile ? [profile.indexId] : nodeIdsForAction()
  if (ids.length) void nodesPageActions.startSpeedTest(action, ids)
}

function moveSelectedNodes(direction: string) {
  if (ensureNodeSelection()) void nodesPageActions.moveSelected(direction)
}

function selectAllNodes() {
  if (!nodesPageState.allVisibleSelected && nodesPageState.filteredProfiles.length) {
    nodesPageActions.toggleAllVisible()
  }
}

function shareSelectedNodes() {
  if (ensureNodeSelection()) nodesPageActions.shareSelected()
}

function copySelectedShareLinks() {
  if (ensureNodeSelection()) nodesPageActions.exportShareLinksToClipboard()
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'))
}

function closeTopLayerOnEscape(event: KeyboardEvent): boolean {
  if (event.key !== 'Escape') return false
  if (activeConfirmation.value) {
    void resolveConfirmation(false)
    event.preventDefault()
    event.stopImmediatePropagation()
    return true
  }

  const flyout = document.querySelector<HTMLElement>('.flyout-menu-popup')
  if (flyout) {
    flyout.dispatchEvent(new Event('menu-escape', { bubbles: true }))
  } else {
    const dropdown = document.querySelector<HTMLElement>('.action-menu-popup:not(.flyout-menu-popup)')
    if (dropdown) {
      dropdown.dispatchEvent(new Event('menu-escape', { bubbles: true }))
    } else if (contextMenu.value) {
      const profileId = contextMenu.value.profile?.indexId
      contextMenu.value = null
      void nextTick(() => {
        const row = [...document.querySelectorAll<HTMLElement>('[data-profile-id]')]
          .find((item) => item.dataset.profileId === profileId)
        row?.focus({ preventScroll: true })
      })
    } else if (exportModalState.showExportDialog) {
      profiles.showExportDialog.value = false
    } else if (routing.ruleModalState.showRuleForm) {
      routing.ruleModalState.showRuleForm = false
    } else if (routing.showRouteForm.value) {
      routing.showRouteForm.value = false
    } else if (subscriptions.showSubscriptionForm.value) {
      subscriptions.showSubscriptionForm.value = false
    } else if (profiles.showImportForm.value) {
      profiles.showImportForm.value = false
    } else if (profiles.showProfileForm.value) {
      profiles.showProfileForm.value = false
    } else {
      return false
    }
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  return true
}

function handleGlobalKeydown(event: KeyboardEvent) {
  if (closeTopLayerOnEscape(event)) return
  if (activePage.value !== 'nodes' || isEditableTarget(event.target)) return
  if (document.querySelector('.modal-shade, .context-menu, .action-menu-popup')) return

  const key = event.key.toLowerCase()
  const control = event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey
  let handled = true
  if (control) {
    switch (key) {
      case 'a': selectAllNodes(); break
      case 'c': copySelectedShareLinks(); break
      case 'd': editContextProfile(); break
      case 'f': shareSelectedNodes(); break
      case 'o': testSelectedNodes('tcping'); break
      case 'r': testSelectedNodes('realping'); break
      case 't': testSelectedNodes('speedtest'); break
      default: handled = false
    }
  } else if (!event.ctrlKey && !event.altKey && !event.metaKey) {
    switch (key) {
      case 'enter': selectContextProfile(); break
      case 'backspace':
      case 'delete': deleteSelectedNodes(); break
      case 't': moveSelectedNodes('top'); break
      case 'u': moveSelectedNodes('up'); break
      case 'd': moveSelectedNodes('down'); break
      case 'b': moveSelectedNodes('bottom'); break
      default: handled = false
    }
  } else {
    handled = false
  }

  if (handled) event.preventDefault()
}

watch(contextMenu, async (menu) => {
  if (!menu) return
  contextMenuPlacement.value = { left: '-10000px', top: '-10000px' }
  await nextTick()
  positionContextMenu(menu)
  contextMenuElement.value?.querySelector<HTMLElement>('button:not(:disabled)')?.focus({ preventScroll: true })
})

const subscriptionsPageState = subscriptions.subscriptionsPageState
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
const logsPageState = logs.logsPageState
const logsPageActions = logs.logsPageActions

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

async function navigate(page: string) {
  activePage.value = page
  contextMenu.value = null
  profiles.selectedIds.value = []
}

watch(activePage, async () => {
  if (authenticated.value) {
    try { await loadPageData() } catch (error) { showError(error) }
  }
})

watch(locale, (value) => {
  localStorage.setItem('v2rayn-web-locale', value)
  document.documentElement.lang = value
}, { immediate: true })

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown, true)
  window.addEventListener('resize', positionOpenContextMenu)
  await session.loadSetupStatus()
  if (setupRequired.value || !sessionToken.value) return
  authenticated.value = true
  try {
    await refreshBase()
    if (authenticated.value) {
      events.openEvents()
      await Promise.all([settings.loadSettings(), routing.loadRouting(), loadPageData()])
      await logs.loadLogs()
    }
  } catch (error) { showError(error) }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown, true)
  window.removeEventListener('resize', positionOpenContextMenu)
  for (const timer of toastTimers.values()) clearTimeout(timer)
  toastTimers.clear()
})

function positionOpenContextMenu() {
  if (contextMenu.value) positionContextMenu(contextMenu.value)
}
</script>

<template>
  <div class="app-shell" @click="contextMenu = null">
    <section v-if="!setupStatusReady" class="auth-wrap"><p class="muted">{{ t('common.loading') }}</p></section>

    <section v-else-if="setupRequired && !setupAllowedFromRequest" class="auth-wrap">
      <div class="auth-box setup-box">
        <div class="auth-title"><img class="brand-glyph" src="/v2rayN.png" alt="" /><div><strong>{{ t('setup.title') }}</strong><small>{{ t('brand') }}</small></div></div>
        <p>{{ t('setup.localOnly') }}</p>
      </div>
    </section>

    <section v-else-if="setupRequired" class="auth-wrap">
      <form class="auth-box setup-box" @submit.prevent="configureManagementKey">
        <div class="auth-title"><img class="brand-glyph" src="/v2rayN.png" alt="" /><div><strong>{{ t('setup.title') }}</strong><small>{{ t('brand') }}</small></div></div>
        <p>{{ t('setup.description') }}</p>
        <div class="form-grid">
          <label>{{ t('setup.managementKey') }}<input v-model="setupKey" type="password" autocomplete="new-password" minlength="12" maxlength="4096" required /></label>
          <label>{{ t('setup.confirmKey') }}<input v-model="setupConfirmKey" type="password" autocomplete="new-password" minlength="12" maxlength="4096" required /></label>
        </div>
        <p v-if="setupError" class="setup-error" role="alert">{{ setupError }}</p>
        <button class="button primary" type="submit" :disabled="setupSubmitting">{{ setupSubmitting ? t('common.working') : t('setup.submit') }}</button>
      </form>
    </section>

    <template v-else>
      <AppHeader :state="headerState" :actions="headerActions" />
    <section v-if="!authenticated" class="auth-wrap">
      <div class="auth-content">
        <form class="auth-box" @submit.prevent="login()">
          <div class="auth-title"><img class="brand-glyph" src="/v2rayN.png" alt="" /><div><strong>{{ t('auth.title') }}</strong><small>{{ t('brand') }}</small></div></div>
          <p>{{ t('auth.hint') }}</p>
          <label class="field-label" for="management-key">{{ t('auth.token') }}</label>
          <div class="inline-field"><input id="management-key" v-model="managementKeyDraft" type="password" autocomplete="current-password" :placeholder="t('auth.placeholder')" /><button class="button primary" type="submit">{{ t('auth.connect') }}</button></div>
        </form>
      </div>
    </section>
      <template v-else>
        <RuntimeStrip :state="runtimeStripState" :actions="runtimeStripActions" />
        <ConnectionStrip :state="connectionStripState" :actions="connectionStripActions" />
        <main class="workspace">
          <NodesPage v-if="activePage === 'nodes'" :state="nodesPageState" :actions="nodesPageActions" />
          <SubscriptionsPage v-else-if="activePage === 'subscriptions'" :state="subscriptionsPageState" :actions="subscriptionsPageActions" />
          <RoutingPage v-else-if="activePage === 'routing'" :state="routingPageState" :actions="routingPageActions" />
          <DnsPage v-else-if="activePage === 'dns'" :state="dnsPageState" :actions="dnsPageActions" />
          <SettingsPage v-else-if="activePage === 'settings'" :state="settingsPageState" :actions="settingsPageActions" />
          <TemplatesPage v-else-if="activePage === 'templates'" :state="templatesPageState" :actions="templatesPageActions" />
          <MaintenancePage v-else-if="activePage === 'maintenance'" :state="maintenancePageState" :actions="maintenancePageActions" />
          <LogsPage v-else-if="activePage === 'logs'" :state="logsPageState" :actions="logsPageActions" />
        </main>
      </template>
    <div v-if="contextMenu" ref="contextMenuElement" class="context-menu" :style="contextMenuPlacement" role="menu" @keydown="navigateMenu($event, contextMenuElement)" @click="contextMenu = null">
      <button role="menuitem" :disabled="contextMenu.profile.isCurrent" @click="selectContextProfile">{{ contextMenu.profile.isCurrent ? t('nodes.current') : t('nodes.switch') }}<span class="menu-shortcut">Enter</span></button>
      <button role="menuitem" @click="editContextProfile">{{ t('common.edit') }}<span class="menu-shortcut">Ctrl+D</span></button>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="copySelectedNodes">{{ t('nodes.copySelected') }}</button>
      <button role="menuitem" class="danger-text" :disabled="!nodesPageState.selectedIds.length" @click="deleteSelectedNodes">{{ t('nodes.removeSelected') }}<span class="menu-shortcut">Back</span></button>
      <button role="menuitem" @click="nodesPageActions.runProfileAction('deduplicate')">{{ t('nodes.deduplicate') }}</button>
      <button role="menuitem" @click="nodesPageActions.runProfileAction('remove-invalid')">{{ t('nodes.removeInvalid') }}</button>
      <div class="context-separator"></div>
      <button role="menuitem" @click="testSelectedNodes('tcping', contextMenu.profile)">{{ t('nodes.tcping') }}<span class="menu-shortcut">Ctrl+O</span></button>
      <button role="menuitem" @click="testSelectedNodes('realping', contextMenu.profile)">{{ t('nodes.realping') }}<span class="menu-shortcut">Ctrl+R</span></button>
      <button role="menuitem" @click="testSelectedNodes('speedtest', contextMenu.profile)">{{ t('nodes.speedtest') }}<span class="menu-shortcut">Ctrl+T</span></button>
      <button role="menuitem" @click="testSelectedNodes('udpTest', contextMenu.profile)">{{ t('nodes.udp') }}</button>
      <button role="menuitem" @click="nodesPageActions.sortProfiles('DelayVal')">{{ t('nodes.sortByTestResults') }}</button>
      <div class="context-separator"></div>
      <FlyoutMenu context :label="t('nodes.moveGroup')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button v-for="group in nodesPageState.groups" :key="group.id || 'all-target'" class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.moveSelectedToGroup(group.id)">{{ group.name || t('common.allGroups') }}</button>
      </FlyoutMenu>
      <FlyoutMenu context :label="t('nodes.move')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('top')">{{ t('nodes.top') }}<span class="menu-shortcut">T</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('up')">{{ t('nodes.up') }}<span class="menu-shortcut">U</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('down')">{{ t('nodes.down') }}<span class="menu-shortcut">D</span></button>
        <button class="action-menu-item" role="menuitem" @click="moveSelectedNodes('bottom')">{{ t('nodes.bottom') }}<span class="menu-shortcut">B</span></button>
      </FlyoutMenu>
      <button role="menuitem" :disabled="!nodesPageState.filteredProfiles.length" @click="selectAllNodes">{{ t('nodes.selectAll') }}<span class="menu-shortcut">Ctrl+A</span></button>
      <div class="context-separator"></div>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="shareSelectedNodes">{{ t('nodes.shareProfile') }}<span class="menu-shortcut">Ctrl+F</span></button>
      <FlyoutMenu context :label="t('nodes.exportMenu')" :disabled="!nodesPageState.selectedIds.length" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportFullConfig">{{ t('nodes.exportFullConfig') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportFullConfigToClipboard">{{ t('nodes.exportFullConfigClipboard') }}</button>
        <div class="action-menu-separator" role="separator"></div>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="copySelectedShareLinks">{{ t('nodes.exportShareLinkClipboard') }}<span class="menu-shortcut">Ctrl+C</span></button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportShareLinksBase64">{{ t('nodes.exportShareLinkBase64') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportInnerUris">{{ t('nodes.exportInnerUri') }}</button>
      </FlyoutMenu>
      <div class="context-separator"></div>
      <FlyoutMenu context :label="t('nodes.generatePolicyGroups')" :disabled="!nodesPageState.selectedGroup" @select="contextMenu = null">
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedGroup" @click="nodesPageActions.generateGroups(false)">{{ t('nodes.allProfiles') }}</button>
        <button class="action-menu-item" role="menuitem" :disabled="!nodesPageState.selectedGroup || !nodesPageState.profiles.length" @click="nodesPageActions.generateGroups(true)">{{ t('nodes.generateRegionGroups') }}</button>
      </FlyoutMenu>
      <div class="context-separator"></div>
      <div class="context-web-only-label">{{ t('nodes.webOnlyActions') }}</div>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.moveSelectedPosition">{{ t('nodes.position') }}…</button>
      <button role="menuitem" :disabled="!nodesPageState.operations.includes('speedtest')" @click="nodesPageActions.stopSpeedTests">{{ t('nodes.stopTest') }}</button>
      <button role="menuitem" :disabled="!nodesPageState.selectedIds.length" @click="nodesPageActions.exportSelected">{{ t('nodes.customExport') }}…</button>
    </div>
    <ProfileModal v-if="showProfileForm" :state="profileModalState" :actions="profileModalActions" :core-type-mappings="profileCoreTypeMappings" />
    <ImportProfilesModal v-if="showImportForm" :state="importProfilesModalState" :actions="importProfilesModalActions" />
    <SubscriptionModal v-if="showSubscriptionForm" :state="subscriptionModalState" :actions="subscriptionModalActions" />
    <RouteModal v-if="showRouteForm" :state="routeModalState" :actions="routeModalActions" />
    <RouteRuleModal v-if="routingPageState && ruleModalState.showRuleForm" :state="ruleModalState" :actions="ruleModalActions" />
    <ExportModal v-if="showExportDialog" :state="exportModalState" :actions="exportModalActions" />
    <ConfirmDialog v-if="activeConfirmation" :message="activeConfirmation.message" @resolve="resolveConfirmation" />
    </template>
    <ToastViewport :toasts="toasts" :close-label="t('common.close')" @dismiss="dismissToast" />
  </div>
</template>
