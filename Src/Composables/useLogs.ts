import { computed, reactive, ref } from 'vue'
import type { ApiServices, Dict, ErrorHandler, Notice, Translate } from './types'

export function useLogs(options: ApiServices & {
  t: Translate
  showError: ErrorHandler
  showNotice: Notice
  confirm: (message: string) => Promise<boolean>
  clearRealtimeQueue?: (generation?: number) => void
}) {
  const t = options.t
  const logs = ref<Dict[]>([])
  const logFilter = ref('')
  const logPage = ref(1)
  const logTotal = ref(0)
  const selectedLogKeys = ref<string[]>([])
  const logPageSize = 100
  let clearRevision = 0
  const logTotalPages = computed(() => Math.max(1, Math.ceil(logTotal.value / logPageSize)))

  async function loadLogs(page = 1) {
    const requestRevision = clearRevision
    try {
      const result = await options.data(options.queryPath('/api/logs/page', { page, pageSize: logPageSize, filter: logFilter.value.trim() }))
      if (requestRevision !== clearRevision) return
      logs.value = result?.items || []
      logPage.value = result?.page || 1
      logTotal.value = result?.total || 0
      selectedLogKeys.value = selectedLogKeys.value.filter((key) => logs.value.some((entry, index) => logKey(entry, index) === key))
    }
    catch (error) { options.showError(error) }
  }

  function matchesLogFilter(entry: Dict): boolean {
    const query = logFilter.value.trim()
    if (!query) return true
    try { return new RegExp(query).test(`${entry.source || ''} ${entry.message || ''}`) }
    catch { return false }
  }

  function changeLogPage(page: number) {
    if (page < 1 || page > logTotalPages.value) return
    void loadLogs(page)
  }

  function logKey(entry: Dict, index: number) {
    return `${entry.timestamp || ''}-${entry.source || ''}-${index}`
  }

  function toggleLog(entry: Dict, index: number) {
    const key = logKey(entry, index)
    selectedLogKeys.value = selectedLogKeys.value.includes(key) ? selectedLogKeys.value.filter((item) => item !== key) : [...selectedLogKeys.value, key]
  }

  function toggleAllLogs() {
    const allSelected = logs.value.length > 0 && logs.value.every((entry, index) => selectedLogKeys.value.includes(logKey(entry, index)))
    selectedLogKeys.value = allSelected ? [] : logs.value.map(logKey)
  }

  function formatLogs(items: Dict[]) {
    return items.map((entry) => `[${entry.timestamp ? new Date(entry.timestamp).toISOString() : ''}] [${entry.source || ''}] ${entry.message || ''}`).join('\n')
  }

  async function copyLogs(items: Dict[]) {
    try {
      await navigator.clipboard.writeText(formatLogs(items))
      options.showNotice(t('common.copySuccess'))
    } catch { options.showNotice(t('common.clipboardUnavailable'), 'error') }
  }

  async function copyCurrentPage() {
    await copyLogs(logs.value)
  }

  async function copySelectedLogs() {
    const selected = logs.value.filter((entry, index) => selectedLogKeys.value.includes(logKey(entry, index)))
    if (selected.length) await copyLogs(selected)
  }

  async function copyAllLogs() {
    try {
      const all: Dict[] = []
      for (let page = 1; page <= logTotalPages.value; page += 1) {
        const result = await options.data(options.queryPath('/api/logs/page', { page, pageSize: logPageSize, filter: logFilter.value.trim() }))
        all.push(...(result?.items || []))
      }
      await copyLogs(all)
    } catch (error) { options.showError(error) }
  }

  async function clearLogs() {
    if (!await options.confirm(t('logs.clearConfirm'))) return
    try {
      const result = await options.request('/api/logs', { method: 'DELETE' })
      clearLogsState(result.data?.generation)
      options.showNotice(options.operationMessage(result))
    } catch (error) { options.showError(error) }
  }

  function clearLogsState(generation?: number) {
    clearRevision += 1
    options.clearRealtimeQueue?.(generation)
    logs.value = typeof generation === 'number'
      ? logs.value.filter((entry) => typeof entry.generation === 'number' && entry.generation >= generation)
      : []
    logPage.value = 1
    logTotal.value = logs.value.length
    selectedLogKeys.value = []
  }

  const logsPageState = reactive({ logTotal, logFilter, logs, logPage, logTotalPages, selectedLogKeys })

  return { logs, logFilter, logPage, logTotal, logPageSize, logTotalPages, matchesLogFilter, loadLogs, clearLogsState, logsPageState, logsPageActions: { loadLogs, clearLogs, changeLogPage, logKey, toggleLog, toggleAllLogs, copyCurrentPage, copySelectedLogs, copyAllLogs } }
}
