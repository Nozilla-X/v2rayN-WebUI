<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ActionDropdown from '../ActionDropdown.vue'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import type { UiProps } from '../types'
import { shouldRenderIpInfoColumn } from '../../Composables/ipInfoColumn.ts'
import PageFeedback from '../UI/PageFeedback.vue'
import { usePageRequests } from '../../UI/useUiRequests'

const { t } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const selectedSubscription = computed(() => state.subscriptions.find((item: Record<string, any>) => item.id === state.selectedGroup) || null)
const autoFitColumns = ref(false)
const showIpInfoColumn = computed(() => shouldRenderIpInfoColumn(state.showIpInfoColumn))
const expandedProfiles = ref(new Set<string>())
const { status, run } = usePageRequests('nodes')
const reloadProfiles = () => run(() => actions.loadProfiles())
const tableWrap = ref<HTMLElement | null>(null)
const currentVisible = computed(() => state.profiles.find((profile: Record<string, any>) => profile.isCurrent))
const testing = computed(() => state.operations.includes('speedtest'))
function locateCurrent() {
  const row = [...(tableWrap.value?.querySelectorAll<HTMLElement>('[data-profile-id]') || [])].find(item => item.dataset.profileId === currentVisible.value?.indexId)
  row?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  const wrap = tableWrap.value
  const header = wrap?.querySelector('thead')
  if (row && wrap && header) {
    const visibleTop = wrap.getBoundingClientRect().top + wrap.clientTop + header.getBoundingClientRect().height
    const covered = visibleTop - row.getBoundingClientRect().top
    if (covered > 0) wrap.scrollTop = Math.max(0, wrap.scrollTop - covered)
  }
  row?.focus({ preventScroll: true })
}
function sortState(column: string) { return state.sorting?.column === column ? (state.sorting.ascending ? 'ascending' : 'descending') : 'none' }
function formatSpeed(value: unknown) { return value === null || value === undefined || value === '' ? '—' : String(value) }
function toggleDetails(id: string) {
  if (expandedProfiles.value.has(id)) expandedProfiles.value.delete(id)
  else expandedProfiles.value.add(id)
}
function selectGroupOnClick(event: MouseEvent, group: Record<string, any>) {
  if (event.detail > 1 || state.selectedGroup === group.id) return
  actions.changeGroup(group.id)
}
function openGroupOnDoubleClick(event: MouseEvent, group: Record<string, any>) {
  if (window.matchMedia('(max-width: 760px)').matches) {
    actions.openSubscriptionContext(event, group)
    return
  }
  const subscription = state.subscriptions.find((item: Record<string, any>) => item.id === group.id)
  if (subscription) void actions.openEditSubscription(subscription)
  else actions.openSubscriptionContext(event, group)
}
function openSelectedGroupContext(event: MouseEvent) {
  const group = state.groups.find((item: Record<string, any>) => (item.id || '') === state.selectedGroup)
    || state.groups.find((item: Record<string, any>) => item.isCurrent)
    || state.groups[0]
  if (group) actions.openSubscriptionContext(event, group)
}
function preventRangeTextSelection(event: MouseEvent) {
  if (!event.shiftKey || event.button !== 0) return
  const target = event.target
  if (target instanceof Element && target.closest('button, input, select, a')) return
  event.preventDefault()
  window.getSelection()?.removeAllRanges()
}
</script>

<template>
<section class="page nodes-page">
  <div class="group-toolbar toolbar">
    <span class="toolbar-label">{{ t('nodes.group') }}</span>
     <div class="group-chips" @contextmenu.prevent.stop="openSelectedGroupContext($event)">
       <span v-for="group in state.groups" :key="group.id || 'all'" class="group-chip-wrap" @contextmenu.prevent.stop="actions.openSubscriptionContext($event, group)" @dblclick.prevent.stop="openGroupOnDoubleClick($event, group)">
          <button :class="['group-chip', { selected: state.selectedGroup === group.id }]" :aria-pressed="state.selectedGroup === group.id" :title="group.name || t('common.allGroups')" @click="selectGroupOnClick($event, group)">
            {{ group.name || t('common.allGroups') }}<small>{{ group.profileCount }}</small>
          </button>
       </span>
    </div>
    <button class="tool-button node-toolbar-action" :disabled="!selectedSubscription" :aria-label="t('subscriptions.editSubscription')" :title="t('subscriptions.editSubscription')" @click="selectedSubscription && actions.openEditSubscription(selectedSubscription)"><UiIcon name="edit" /></button>
    <button class="tool-button node-toolbar-action" :aria-label="t('subscriptions.addSubscription')" :title="t('subscriptions.addSubscription')" @click="actions.openAddSubscription"><UiIcon name="plus" /></button>
    <label class="search-box"><UiIcon name="search" /><input v-model="state.filter" :aria-label="t('nodes.filterPlaceholder')" aria-describedby="nodes-search-hint" :placeholder="t('nodes.filterPlaceholder')" @keyup.enter="reloadProfiles" /><button v-if="state.filter" class="clear-search" :aria-label="t('polish.clearSearch')" @click="state.filter = ''; reloadProfiles()"><UiIcon name="close" /></button></label>
    <button class="tool-button node-toolbar-action node-autofit-action" :class="{ selected: autoFitColumns }" :aria-pressed="autoFitColumns" :aria-label="t('nodes.autoFitColumns')" :title="t('nodes.autoFitColumns')" @click="autoFitColumns = !autoFitColumns"><UiIcon name="fit" /></button>
    <button class="tool-button node-toolbar-action" :aria-label="t('nodes.fastRealping')" :title="t('nodes.fastRealping')" @click="actions.startSpeedTest('fastRealping')"><UiIcon name="bolt" /></button>
    <button class="tool-button node-toolbar-action" :aria-label="t('nodes.mixedtest')" :title="t('nodes.mixedtest')" @click="actions.startSpeedTest('mixedtest')"><UiIcon name="speed" /></button>
  </div>

  <div class="page-header page-toolbar nodes-page-toolbar">
    <div class="page-title"><h1>{{ t('nodes.title') }}</h1><span class="count-tag">{{ state.filteredProfiles.length }}</span><span v-if="state.selectedIds.length" class="selection-summary"><strong>{{ t('common.selected', { count: state.selectedIds.length }) }}</strong><button class="selection-clear" :aria-label="t('common.clearSelection')" :title="t('common.clearSelection')" @click="state.selectedIds = []"><UiIcon name="close" :size="12" /></button></span></div>
    <div class="toolbar-main">
      <button class="tool-button locate-current" :disabled="!currentVisible" :aria-label="t('polish.locateCurrent')" :title="t('polish.locateCurrent')" @click="locateCurrent"><UiIcon name="check" /></button>
      <ActionDropdown class="mobile-node-tools" :label="t('nodes.toolsMenu')">
        <button class="action-menu-item" role="menuitem" :disabled="!selectedSubscription" @click="selectedSubscription && actions.openEditSubscription(selectedSubscription)">{{ t('subscriptions.editSubscription') }}</button>
        <button class="action-menu-item" role="menuitem" @click="actions.openAddSubscription">{{ t('subscriptions.addSubscription') }}</button>
        <div class="action-menu-separator" role="separator"></div>
        <button class="action-menu-item" role="menuitemcheckbox" :aria-checked="autoFitColumns" @click="autoFitColumns = !autoFitColumns">{{ t('nodes.autoFitColumns') }}<UiIcon v-if="autoFitColumns" name="check" :size="12" /></button>
        <div class="action-menu-separator" role="separator"></div>
        <button class="action-menu-item" role="menuitem" @click="actions.startSpeedTest('fastRealping')">{{ t('nodes.fastRealping') }}</button>
        <button class="action-menu-item" role="menuitem" @click="actions.startSpeedTest('mixedtest')">{{ t('nodes.mixedtest') }}</button>
      </ActionDropdown>
      <ActionDropdown :label="t('nodes.addMenu')" prefix="plus" variant="primary"><button class="action-menu-item" role="menuitem" @click="actions.openAddProfile">{{ t('nodes.addNode') }}</button><button class="action-menu-item" role="menuitem" @click="actions.openImportProfiles">{{ t('nodes.importNodes') }}…</button></ActionDropdown>
    </div>
  </div>
  <div class="nodes-feedback-slot">
    <PageFeedback v-if="!testing || status.error" scope="nodes" />
    <div v-if="testing" class="operation-status" role="status"><span class="status-led on"></span><span class="operation-status-label">{{ t('polish.testing') }}</span><button class="link-button danger-text" @click="actions.stopSpeedTests">{{ t('nodes.stopTest') }}</button><span v-if="status.reads || status.writes" class="muted speedtest-refresh">{{ t('common.loading') }}</span></div>
  </div>

  <div ref="tableWrap" class="table-container table-wrap" :aria-busy="Boolean(status.reads)" :class="{ 'auto-fit-columns': autoFitColumns }">
    <table class="profile-table">
      <thead><tr>
        <th class="check-cell"><UiCheckbox :model-value="state.allVisibleSelected" :indeterminate="Boolean(state.selectedIds.length && !state.allVisibleSelected)" :aria-label="t('common.selected', { count: state.filteredProfiles.length })" @change="actions.toggleAllVisible" /></th>
        <th :aria-sort="sortState('ConfigType')"><button class="sort-button" @click="actions.sortProfiles('ConfigType')">{{ t('nodes.type') }}</button></th>
        <th :aria-sort="sortState('Remarks')"><button class="sort-button" @click="actions.sortProfiles('Remarks')">{{ t('nodes.remarks') }}</button></th>
        <th :aria-sort="sortState('Address')"><button class="sort-button" @click="actions.sortProfiles('Address')">{{ t('nodes.address') }}</button></th>
        <th class="number-header" :aria-sort="sortState('Port')"><button class="sort-button" @click="actions.sortProfiles('Port')">{{ t('nodes.port') }}</button></th>
        <th :aria-sort="sortState('Network')"><button class="sort-button" @click="actions.sortProfiles('Network')">{{ t('nodes.network') }}</button></th>
        <th :aria-sort="sortState('StreamSecurity')"><button class="sort-button" @click="actions.sortProfiles('StreamSecurity')">{{ t('nodes.tls') }}</button></th>
        <th :aria-sort="sortState('SubRemarks')"><button class="sort-button" @click="actions.sortProfiles('SubRemarks')">{{ t('nodes.groupColumn') }}</button></th>
        <th class="number-header" :aria-sort="sortState('DelayVal')"><button class="sort-button" @click="actions.sortProfiles('DelayVal')">{{ t('nodes.delay') }}</button></th>
        <th class="number-header" :aria-sort="sortState('SpeedVal')"><button class="sort-button" @click="actions.sortProfiles('SpeedVal')">{{ t('nodes.speed') }}</button></th>
        <th v-if="showIpInfoColumn">{{ t('nodes.ip') }}</th>
        <th class="number-header"><button class="sort-button" @click="actions.sortProfiles('TodayUp')"><UiIcon name="arrow-up" :size="11" /> {{ t('nodes.todayUp') }}</button></th>
        <th class="number-header"><button class="sort-button" @click="actions.sortProfiles('TodayDown')"><UiIcon name="arrow-down" :size="11" /> {{ t('nodes.todayDown') }}</button></th>
        <th class="number-header"><button class="sort-button" @click="actions.sortProfiles('TotalUp')"><UiIcon name="arrow-up" :size="11" /> {{ t('nodes.totalUp') }}</button></th>
        <th class="number-header"><button class="sort-button" @click="actions.sortProfiles('TotalDown')"><UiIcon name="arrow-down" :size="11" /> {{ t('nodes.totalDown') }}</button></th>
        <th class="actions-cell">{{ t('nodes.actions') }}</th>
      </tr></thead>
      <tbody>
        <tr v-for="profile in state.filteredProfiles" :key="profile.indexId" :data-profile-id="profile.indexId" :tabindex="state.focusedProfileId === profile.indexId ? 0 : -1" :aria-current="profile.isCurrent ? 'true' : undefined" :aria-selected="state.selectedIds.includes(profile.indexId)" :class="{ current: profile.isCurrent, selected: state.selectedIds.includes(profile.indexId), 'details-open': expandedProfiles.has(profile.indexId) }" @focus="actions.setFocusedProfile(profile.indexId)" @mousedown="preventRangeTextSelection($event)" @click="actions.focusProfile($event, profile)" @keydown="actions.handleRowKeydown($event, profile)" @dblclick="actions.selectProfile(profile)" @contextmenu.stop.prevent="actions.openContext($event, profile)">
          <td class="check-cell"><label class="node-select-label" @click.stop @dblclick.stop><UiCheckbox :model-value="state.selectedIds.includes(profile.indexId)" :aria-label="profile.remarks || profile.address" @change="actions.toggleProfile(profile.indexId)" @click.stop /></label></td>
          <td class="node-protocol node-badge" :data-label="t('nodes.type')" :title="t('nodes.type')"><span class="protocol-code">{{ profile.protocol }}</span></td>
          <td class="remark-cell" :data-label="t('nodes.remarks')"><UiIcon v-if="profile.isCurrent" class="current-marker" name="check" :size="12" :title="t('nodes.current')" /><span class="remark-text" :title="profile.remarks">{{ profile.remarks || '—' }}</span><span v-if="profile.protocol" class="mobile-node-type" :aria-label="`${t('nodes.type')}: ${profile.protocol}`">{{ profile.protocol }}</span></td>
          <td class="address-cell node-endpoint" :data-label="t('nodes.address')" :title="profile.address"><span class="node-endpoint-value">{{ profile.address }}<span class="mobile-node-port">:{{ profile.port }}</span></span><span class="mobile-node-transport" :aria-label="`${t('nodes.network')}: ${profile.network || '—'}; ${t('nodes.tls')}: ${profile.streamSecurity || '—'}`">{{ profile.network || '—' }} · {{ profile.streamSecurity || '—' }}</span></td>
          <td class="number-cell node-port" :data-label="t('nodes.port')">{{ profile.port }}</td>
          <td class="node-network node-badge" :data-label="t('nodes.network')" :title="t('nodes.network')">{{ profile.network || '—' }}</td>
          <td class="node-security node-badge" :data-label="t('nodes.tls')" :title="t('nodes.tls')">{{ profile.streamSecurity || '—' }}</td>
          <td class="group-cell node-detail-cell" :data-label="t('nodes.groupColumn')" :title="profile.subscriptionName">{{ profile.subscriptionName || t('common.none') }}</td>
          <td :data-label="t('nodes.delay')" :class="['number-cell', 'delay-cell', 'node-metric', { bad: profile.delay < 0 }]">{{ actions.formatDelay(profile.delay) }}</td>
          <td class="number-cell node-metric" :data-label="t('nodes.speed')">{{ formatSpeed(profile.speed) }}</td>
          <td v-if="showIpInfoColumn" class="ip-cell node-detail-cell" :data-label="t('nodes.ip')" :title="profile.ipInfo">{{ profile.ipInfo || '—' }}</td>
          <td class="number-cell node-detail-cell" :data-label="t('nodes.todayUp')">{{ actions.formatBytes(profile.todayUp) }}</td><td class="number-cell node-detail-cell" :data-label="t('nodes.todayDown')">{{ actions.formatBytes(profile.todayDown) }}</td>
          <td class="number-cell node-detail-cell" :data-label="t('nodes.totalUp')">{{ actions.formatBytes(profile.totalUp) }}</td><td class="number-cell node-detail-cell" :data-label="t('nodes.totalDown')">{{ actions.formatBytes(profile.totalDown) }}</td>
          <td class="row-actions" :data-label="t('nodes.actions')" @dblclick.stop><button class="tool-button row-more" :aria-label="t('nodes.actions')" :title="t('nodes.actions')" @click.stop="actions.openContext($event, profile)"><UiIcon name="more" /></button></td>
          <td class="mobile-node-details" @dblclick.stop><button type="button" :aria-label="t(expandedProfiles.has(profile.indexId) ? 'nodes.collapseDetails' : 'nodes.showDetails')" :aria-expanded="expandedProfiles.has(profile.indexId)" @click.stop="toggleDetails(profile.indexId)"><span class="mobile-details-label">{{ t(expandedProfiles.has(profile.indexId) ? 'nodes.collapseDetails' : 'nodes.showDetails') }}</span><UiIcon name="chevron-down" :size="12" /></button></td>
        </tr>
        <tr v-if="!state.filteredProfiles.length"><td :colspan="showIpInfoColumn ? 15 : 14" class="empty-row">{{ status.reads ? t('common.loading') : state.filter ? t('common.noResults') : t('nodes.noProfile') }}<button v-if="state.filter && !status.reads" class="link-button" @click="state.filter = ''; reloadProfiles()">{{ t('polish.clearSearch') }}</button><button v-else-if="!status.reads" class="link-button" @click="actions.openAddProfile">{{ t('nodes.addNode') }}</button></td></tr>
      </tbody>
    </table>
  </div>
  <div class="table-footer"><span id="nodes-search-hint">{{ t('nodes.regexHint') }}</span><span class="node-keyboard-hint">{{ t('polish.nodeKeyboard') }}</span></div>
</section>
</template>
