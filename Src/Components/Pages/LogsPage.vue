<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UiProps } from '../types'
import UiIcon from '../UiIcon.vue'
import UiCheckbox from '../UiCheckbox.vue'
import ActionDropdown from '../ActionDropdown.vue'
import PageFeedback from '../UI/PageFeedback.vue'
import { usePageRequests } from '../../UI/useUiRequests'

const { t, locale } = useI18n()
const props = defineProps<UiProps>()
const state = props.state
const actions = props.actions
const logPanel = ref<HTMLElement | null>(null)
const autoScroll = ref(true)
const followOutput = ref(true)
const { status } = usePageRequests('logs')
const levelFilter = ref('all')
// Portable across the existing .NET Backend filter and browser SSE filter; no invented severity field.
const levelPatterns: Record<string, string> = { all: '', errors: '[Ee][Rr][Rr][Oo][Rr]|[Ff][Aa][Tt][Aa][Ll]', warnings: '[Ww][Aa][Rr][Nn]', info: '[Ii][Nn][Ff][Oo]', debug: '[Dd][Ee][Bb][Uu][Gg]|[Tt][Rr][Aa][Cc][Ee]' }
function applyLevelFilter() { state.logFilter = levelPatterns[levelFilter.value]; void actions.loadLogs(1) }
async function jumpToLatest() { followOutput.value = true; await actions.loadLogs(1); await nextTick(); if (logPanel.value) logPanel.value.scrollTop = logPanel.value.scrollHeight }
const allSelected = computed(() => state.logs.length > 0 && state.logs.every((log: Record<string, any>, index: number) => state.selectedLogKeys.includes(actions.logKey(log, index))))
onMounted(async () => {
  await nextTick()
  if (autoScroll.value && logPanel.value) logPanel.value.scrollTop = logPanel.value.scrollHeight
})

watch(() => state.logs, async () => {
  await nextTick()
  if (autoScroll.value && followOutput.value && logPanel.value) logPanel.value.scrollTop = logPanel.value.scrollHeight
}, { flush: 'post' })

watch(autoScroll, async (enabled) => {
  if (!enabled) return
  followOutput.value = true
  await nextTick()
  if (logPanel.value) logPanel.value.scrollTop = logPanel.value.scrollHeight
})

function updateFollowOutput() {
  const panel = logPanel.value
  if (!panel) return
  followOutput.value = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 48
}
</script>

<template>
  <section class="page logs-page">
    <div class="page-header page-toolbar"><div class="page-title"><h1>{{ t('logs.title') }}</h1><span class="count-tag">{{ state.logTotal }}</span></div>
      <div class="toolbar toolbar-main log-toolbar"><label class="search-box log-search"><UiIcon name="search" /><input v-model="state.logFilter" :aria-label="t('logs.filter')" :placeholder="t('logs.filter')" @input="levelFilter = 'all'" @keyup.enter="actions.loadLogs(1)" /></label><button class="button" @click="actions.loadLogs(1)">{{ t('logs.load') }}</button><span class="desktop-log-actions"><button class="button" :disabled="!state.selectedLogKeys.length" @click="actions.copySelectedLogs">{{ t('logs.copySelected') }}</button><button class="button" @click="actions.copyCurrentPage">{{ t('logs.copyPage') }}</button><button class="button" @click="actions.copyAllLogs">{{ t('logs.copyAll') }}</button><button class="button danger" @click="actions.clearLogs">{{ t('logs.clear') }}</button></span>
        <ActionDropdown class="mobile-log-menu" :label="t('common.more')">
          <button class="action-menu-item" role="menuitem" :disabled="!state.selectedLogKeys.length" @click="actions.copySelectedLogs">{{ t('logs.copySelected') }}</button>
          <button class="action-menu-item" role="menuitem" @click="actions.copyCurrentPage">{{ t('logs.copyPage') }}</button>
          <button class="action-menu-item" role="menuitem" @click="actions.copyAllLogs">{{ t('logs.copyAll') }}</button>
          <button class="action-menu-item danger" role="menuitem" @click="actions.clearLogs">{{ t('logs.clear') }}</button>
        </ActionDropdown>
      </div>
    </div>
    <PageFeedback scope="logs" />
    <div class="logs-options"><label class="check-inline"><UiCheckbox v-model="autoScroll" />{{ t('logs.autoScroll') }}</label><button class="button compact" :aria-pressed="Boolean(state.livePaused)" @click="actions.toggleLive">{{ t(state.livePaused ? 'polish.resumeLogs' : 'polish.pauseLogs') }}</button><button v-if="!followOutput || state.logPage !== 1" class="button compact" @click="jumpToLatest">{{ t('polish.followLogs') }}</button><label class="compact-filter">{{ t('polish.logLevels') }}<select v-model="levelFilter" class="compact-select" :title="t('polish.levelHint')" @change="applyLevelFilter"><option value="all">{{ t('polish.levelAll') }}</option><option value="errors">{{ t('polish.levelErrors') }}</option><option value="warnings">{{ t('polish.levelWarnings') }}</option><option value="info">{{ t('polish.levelInfo') }}</option><option value="debug">{{ t('polish.levelDebug') }}</option></select></label><span class="muted">{{ t('logs.regexHint') }}</span></div>
    <p v-if="state.livePaused" class="field-hint" role="status">{{ t('polish.pausedHint') }}</p>
    <div ref="logPanel" class="table-container log-table-wrap" :aria-busy="Boolean(status.reads)" @scroll.passive="updateFollowOutput"><table class="data-table log-table"><thead><tr><th class="check-cell"><UiCheckbox :model-value="allSelected" :aria-label="t('common.selectAll')" @change="actions.toggleAllLogs" /></th><th>{{ t('logs.time') }}</th><th>{{ t('logs.source') }}</th><th>{{ t('logs.message') }}</th></tr></thead><tbody><tr v-for="(log, index) in state.logs" :key="`${log.timestamp}-${index}`" :class="{ selected: state.selectedLogKeys.includes(actions.logKey(log, index)) }"><td class="check-cell"><UiCheckbox :model-value="state.selectedLogKeys.includes(actions.logKey(log, index))" :aria-label="log.message" @change="actions.toggleLog(log, index)" /></td><td class="log-time">{{ new Date(log.timestamp).toLocaleTimeString(locale, { hour12: false }) }}</td><td><span class="source-tag">{{ log.source }}</span></td><td class="log-message">{{ log.message }}</td></tr><tr v-if="!state.logs.length"><td colspan="4" class="empty-row">{{ status.reads ? t('common.loading') : state.logFilter ? t('polish.noResults') : t('logs.noLogs') }}</td></tr></tbody></table></div>
    <div class="logs-pagination"><span>{{ t('logs.totalRows', { total: state.logTotal }) }}</span><div class="pagination-controls"><button class="button compact" :disabled="state.logPage <= 1" @click="actions.changeLogPage(1)">{{ t('logs.firstPage') }}</button><button class="button compact" :disabled="state.logPage <= 1" @click="actions.changeLogPage(state.logPage - 1)">{{ t('logs.previousPage') }}</button><strong>{{ t('logs.pageIndicator', { page: state.logPage, pages: state.logTotalPages }) }}</strong><button class="button compact" :disabled="state.logPage >= state.logTotalPages" @click="actions.changeLogPage(state.logPage + 1)">{{ t('logs.nextPage') }}</button><button class="button compact" :disabled="state.logPage >= state.logTotalPages" @click="actions.changeLogPage(state.logTotalPages)">{{ t('logs.lastPage') }}</button></div></div>
  </section>
</template>
