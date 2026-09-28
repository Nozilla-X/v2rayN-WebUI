import { onUnmounted, watch, type Ref } from 'vue'
import type { Dict, RequestApi, Notice, Translate } from './types'
import { enqueueLogEntry, takeLogBatch } from './logBatch.js'

export function useEvents(options: {
  token: Ref<string>
  activePage: Ref<string>
  status: Ref<Dict | null>
  logs: Ref<Dict[]>
  logTotal: Ref<number>
  logPage: Ref<number>
  logPageSize: number
  request: RequestApi
  t: Translate
  showNotice: Notice
  matchesLogFilter: (entry: Dict) => boolean
  loadGroups: () => Promise<void>
  loadProfiles: () => Promise<void>
  loadSubscriptions: () => Promise<void>
  loadStatus: () => Promise<void>
  loadRouting: () => Promise<void>
  loadOperations: () => Promise<void>
  onCoreUpdateProgress: (progress: Dict) => void
  onCoreUpdateBatchComplete: (result: Dict) => void
  onGeoUpdateComplete: (result: Dict) => void
  onLogsCleared: (generation: number) => void
}) {
  const t = options.t
  let eventSource: EventSource | undefined
  let connectionGeneration = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectAttempts = 0
  let ticketRequestGeneration: number | undefined
  let reconnectNotified = false
  let logEventSource: EventSource | undefined
  let logEventHandler: EventListener | undefined
  let eventSourceIncludesLogs = false
  let minimumLogGeneration = 0

  function openEvents() {
    closeEvents()
    if (!options.token.value) return
    void connectEvents(connectionGeneration)
  }

  const pendingLogs: Dict[] = []
  let logFlushTimer: ReturnType<typeof setTimeout> | undefined
  const logFlushIntervalMs = 75

  function clearPendingLogQueue(generation?: number) {
    if (typeof generation === 'number') minimumLogGeneration = Math.max(minimumLogGeneration, generation)
    if (typeof generation === 'number') {
      let write = 0
      for (const entry of pendingLogs) {
        if (typeof entry.generation === 'number' && entry.generation >= generation) {
          pendingLogs[write++] = entry
        }
      }
      pendingLogs.length = write
    } else {
      pendingLogs.length = 0
    }
    clearTimeout(logFlushTimer)
    logFlushTimer = pendingLogs.length ? setTimeout(flushLogBatch, logFlushIntervalMs) : undefined
  }

  function flushLogBatch() {
    clearTimeout(logFlushTimer)
    logFlushTimer = undefined
    if (options.activePage.value !== 'logs') {
      clearPendingLogQueue()
      return
    }
    const batch = takeLogBatch(pendingLogs)
    if (!batch.length) return
    const matching = batch.filter(options.matchesLogFilter)
    if (!matching.length) return
    options.logTotal.value += matching.length
    if (options.logPage.value === 1) {
      options.logs.value = [...options.logs.value, ...matching].slice(-options.logPageSize)
    }
  }

  function enqueueLog(entry: Dict) {
    if (options.activePage.value !== 'logs') return
    if (typeof entry.generation === 'number' && entry.generation < minimumLogGeneration) return
    enqueueLogEntry(pendingLogs, entry)
    if (pendingLogs.length >= 100) {
      flushLogBatch()
    } else if (!logFlushTimer) {
      logFlushTimer = setTimeout(flushLogBatch, logFlushIntervalMs)
    }
  }

  function detachLogListener() {
    if (logEventSource && logEventHandler) {
      logEventSource.removeEventListener('log', logEventHandler)
    }
    logEventSource = undefined
    logEventHandler = undefined
    clearPendingLogQueue()
  }

  function attachLogListener() {
    const source = eventSource
    if (!source || options.activePage.value !== 'logs' || logEventSource === source) return
    detachLogListener()
    const handler: EventListener = (event) => {
      const entry = JSON.parse((event as MessageEvent).data)
      enqueueLog(entry)
    }
    logEventSource = source
    logEventHandler = handler
    source.addEventListener('log', handler)
  }

  async function connectEvents(generation: number) {
    if (generation !== connectionGeneration || !options.token.value || ticketRequestGeneration === generation) return
    ticketRequestGeneration = generation
    try {
      const response = await options.request('/api/auth/sse-ticket', { method: 'POST' })
      const ticket = response.data?.ticket
      if (typeof ticket !== 'string' || generation !== connectionGeneration || !options.token.value) return

      const includeLogs = options.activePage.value === 'logs'
      eventSourceIncludesLogs = includeLogs
      const source = new EventSource(`/api/events?sse_ticket=${encodeURIComponent(ticket)}&include_logs=${includeLogs}`)
      eventSource = source
      attachLogListener()
      source.onopen = () => {
        if (eventSource === source) {
          reconnectAttempts = 0
          reconnectNotified = false
          void options.loadStatus().catch(() => {})
        }
      }
      source.addEventListener('status', (event) => { options.status.value = JSON.parse((event as MessageEvent).data) })
      source.addEventListener('traffic', (event) => {
      if (options.status.value) options.status.value.traffic = JSON.parse((event as MessageEvent).data)
      })
      source.addEventListener('core-update-progress', (event) => {
        const progress = JSON.parse((event as MessageEvent).data) as Dict
        options.onCoreUpdateProgress(progress)
        if (progress.phase === 'checking' || progress.isComplete) {
          void options.loadOperations().catch(() => {})
        }
      })
      source.addEventListener('core-update-batch-completed', (event) => {
        options.onCoreUpdateBatchComplete(JSON.parse((event as MessageEvent).data) as Dict)
        void options.loadOperations().catch(() => {})
      })
      source.addEventListener('logs-cleared', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as Dict
        const generation = typeof payload.generation === 'number' ? payload.generation : minimumLogGeneration
        clearPendingLogQueue(generation)
        options.onLogsCleared(generation)
      })
      for (const eventName of ['profiles-changed', 'subscription-progress', 'speedtest-result', 'settings-changed', 'core-state', 'geo-update-progress', 'geo-update-completed', 'xray-update-completed']) {
        source.addEventListener(eventName, (event) => {
        if (eventName === 'core-state') {
          const state = JSON.parse((event as MessageEvent).data) as Dict
          if (options.status.value) {
            Object.assign(options.status.value, {
              runtimeState: state.state,
              coreType: state.coreType,
              coreStartedAt: state.startedAt,
              runningProfileId: state.profileId,
              runningProxyPort: state.proxyPort,
              apiPort: state.apiPort,
              coreProcessIds: state.processIds || [],
              runtimeFailure: state.lastFailure,
            })
          }
        }
        if (eventName === 'profiles-changed' || eventName === 'subscription-progress') {
          void options.loadGroups().then(options.loadProfiles).then(options.loadSubscriptions).catch(() => {})
        }
        if (eventName === 'settings-changed' || eventName === 'core-state') {
          void Promise.all([options.loadStatus(), options.loadRouting()]).catch(() => {})
        }
        if (eventName === 'geo-update-completed') {
          options.onGeoUpdateComplete(JSON.parse((event as MessageEvent).data) as Dict)
        }
        if (eventName.includes('update')) void options.loadOperations().catch(() => {})
      })
      }
      source.onerror = () => {
        if (eventSource !== source) return
        detachLogListener()
        source.close()
        eventSource = undefined
        scheduleReconnect(generation)
      }
    } catch {
      scheduleReconnect(generation)
    } finally {
      if (ticketRequestGeneration === generation) ticketRequestGeneration = undefined
    }
  }

  function scheduleReconnect(generation: number) {
    if (generation !== connectionGeneration || !options.token.value || reconnectTimer) return
    const delay = Math.min(1000 * 2 ** Math.min(reconnectAttempts, 5), 30000)
    reconnectAttempts += 1
    if (reconnectAttempts >= 5 && !reconnectNotified) {
      reconnectNotified = true
      options.showNotice(t('common.unknownError'), 'error')
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined
      void connectEvents(generation)
    }, delay)
  }

  function closeEvents() {
    connectionGeneration += 1
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    reconnectAttempts = 0
    detachLogListener()
    eventSource?.close()
    eventSource = undefined
    eventSourceIncludesLogs = false
    ticketRequestGeneration = undefined
    reconnectNotified = false
  }

  watch(options.activePage, (page) => {
    if (options.token.value && (page === 'logs') !== eventSourceIncludesLogs) {
      openEvents()
      return
    }
    if (page === 'logs') attachLogListener()
    else detachLogListener()
  })

  onUnmounted(closeEvents)

  return { openEvents, closeEvents, clearPendingLogQueue }
}
