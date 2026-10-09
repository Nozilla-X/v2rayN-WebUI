import { computed, type Ref } from 'vue'
import type { Dict } from '../../Composables/types'
import type { useProfiles } from '../../Composables/useProfiles'
import type { useSubscriptions } from '../../Composables/useSubscriptions'
import type { useSettings } from '../../Composables/useSettings'

/** Adapter shared by the Nodes toolbar, context menu and keyboard shortcuts. */
export function useNodeActions(
  profiles: ReturnType<typeof useProfiles>,
  subscriptions: ReturnType<typeof useSubscriptions>,
  settings: ReturnType<typeof useSettings>,
  contextMenu: Ref<Dict | null>,
  formatBytes: (value: number | null | undefined) => string,
) {
  const emptyProfileExportOptions = { includeShareUris: false, base64ShareUris: false, includeInnerUri: false, includeClientConfig: false }
  type ProfileExportOptions = Partial<typeof emptyProfileExportOptions>
  async function openProfileExport(options: ProfileExportOptions, profileIds?: string[]) {
    Object.assign(profiles.exportModalState.exportOptions, emptyProfileExportOptions, options)
    const previousSelection = profiles.selectedIds.value
    if (profileIds) profiles.selectedIds.value = profileIds
    try { await profiles.nodesPageActions.exportSelected() }
    finally { if (profileIds) profiles.selectedIds.value = previousSelection }
  }
  async function copyProfileExport(options: ProfileExportOptions, profileIds?: string[]) {
    await openProfileExport(options, profileIds)
    if (!profiles.exportModalState.showExportDialog) return
    await profiles.exportModalActions.copyExport()
    profiles.exportModalState.showExportDialog = false
  }
  const nodesPageState = Object.assign(profiles.nodesPageState, {
    subscriptions: subscriptions.subscriptions,
    showIpInfoColumn: computed(() => settings.settings.value.showIpInfoColumn === true),
  })
  const nodesPageActions = {
    ...profiles.nodesPageActions,
    deleteSubscriptionGroup: subscriptions.subscriptionsPageActions.deleteSubscription,
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
    exportInnerUris: () => copyProfileExport({ includeInnerUri: true }), formatBytes,
  }
  function nodeProfileForAction(event?: Event): Dict | undefined {
    const target = event?.target
    const rowId = target instanceof Element ? target.closest<HTMLElement>('[data-profile-id]')?.dataset.profileId : undefined
    const id = rowId || nodesPageState.focusedProfileId || contextMenu.value?.profile?.indexId || profiles.selectedIds.value[0]
    return profiles.profiles.value.find((profile) => profile.indexId === id) || (contextMenu.value?.profile as Dict | undefined)
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
  function addSubscriptionFromContext() {
    contextMenu.value = null
    void subscriptions.subscriptionsPageActions.openAddSubscription()
  }
  function editSubscriptionFromContext() {
    const group = contextMenu.value?.group
    const subscription = subscriptions.subscriptions.value.find((item) => item.id === group?.id)
    contextMenu.value = null
    if (subscription) void subscriptions.subscriptionsPageActions.openEditSubscription(subscription)
  }
  function deleteSubscriptionFromContext() {
    const group = contextMenu.value?.group
    const subscription = subscriptions.subscriptions.value.find((item) => item.id === group?.id)
    contextMenu.value = null
    if (subscription) void subscriptions.subscriptionsPageActions.deleteSubscription(subscription)
  }
  function editContextProfile() {
    const profile = nodeProfileForAction()
    if (profile) void profiles.openEditProfile(profile)
  }
  function copySelectedNodes() { if (ensureNodeSelection()) void nodesPageActions.runProfileAction('copy') }
  function deleteSelectedNodes() { if (ensureNodeSelection()) void nodesPageActions.runProfileAction('delete') }
  function testSelectedNodes(action: string) {
    const ids = nodeIdsForAction()
    if (ids.length) void nodesPageActions.startSpeedTest(action, ids)
  }
  function moveSelectedNodes(direction: string) { if (ensureNodeSelection()) void nodesPageActions.moveSelected(direction) }
  function selectAllNodes() {
    if (!nodesPageState.allVisibleSelected && nodesPageState.filteredProfiles.length) nodesPageActions.toggleAllVisible()
  }
  function shareSelectedNodes() { if (ensureNodeSelection()) nodesPageActions.shareSelected() }
  function copySelectedShareLinks() { if (ensureNodeSelection()) nodesPageActions.exportShareLinksToClipboard() }
  const contextActions = { selectContextProfile, addSubscriptionFromContext, editSubscriptionFromContext, deleteSubscriptionFromContext, editContextProfile, copySelectedNodes, deleteSelectedNodes, testSelectedNodes, moveSelectedNodes, selectAllNodes, shareSelectedNodes, copySelectedShareLinks }
  return { nodesPageState, nodesPageActions, contextActions }
}
